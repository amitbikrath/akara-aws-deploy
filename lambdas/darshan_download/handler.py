"""Darśana download + downloader lookup.

POST /api/darshan/download  {id, part?, bundle?}   any signed-in user (JWT)
    → full-size JPEG of the original with an invisible, per-download
      fingerprint; returns a short-lived presigned URL. Every download is
      logged in `akara-downloads`.
      Multi-image posts (cover + slideKeys):
        part=k       slide k (0 = cover), its own fingerprint
        part='full'  strip post: every strip joined at one height, one fingerprint
        bundle=true  carousel post: a zip of every slide, each fingerprinted
POST /api/darshan/find      {image, itemId?}  admin group only
    → which logged download a found copy came from.

Fingerprint: a pseudo-random ±1 pattern on a coarse grid (seeded by the
download id), smoothly upsampled and added to the image at ~2/255, scaled up
in textured areas and down in flat ones. Detection is non-blind: the found
copy is resized to the original's size, the original is subtracted, and the
residual is correlated with each candidate download's pattern. Survives
resizing, re-saving as JPEG and colour tweaks; a heavy crop or an AI redraw
can defeat it.
"""
import base64, hashlib, io, json, os, secrets, time, zipfile
from datetime import datetime, timezone

import boto3
import numpy as np
from boto3.dynamodb.conditions import Key
from PIL import Image, ImageFilter

REGION = os.environ.get('AWS_REGION', 'us-east-1')
ASSETS = os.environ['ASSETS_BUCKET']
CATALOG = os.environ.get('CATALOG_TABLE', 'akara-catalog')
DOWNLOADS = os.environ.get('DOWNLOADS_TABLE', 'akara-downloads')
GRID = 128          # pattern cells along each side
ALPHA = 2.0         # base strength in 8-bit levels
Z_MATCH = 6.0       # correlation z-score needed to name a downloader

s3 = boto3.client('s3', region_name=REGION)
ddb = boto3.resource('dynamodb', region_name=REGION)
Image.MAX_IMAGE_PIXELS = 120_000_000

CORS = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}


def resp(code, body):
    return {'statusCode': code, 'headers': CORS, 'body': json.dumps(body, default=str)}


def claims(event):
    a = (event.get('requestContext') or {}).get('authorizer') or {}
    return (a.get('jwt') or {}).get('claims') or a.get('claims') or None


def is_admin(c):
    g = c.get('cognito:groups', '')
    groups = g if isinstance(g, list) else str(g).replace('[', ' ').replace(']', ' ').replace(',', ' ').split()
    return 'admin' in groups


# ───────── pattern ─────────
def pattern(seed, w, h):
    rng = np.random.default_rng(int(seed, 16))
    p = rng.choice(np.array([-1.0, 1.0], dtype=np.float32), size=(GRID, GRID))
    up = Image.fromarray(p, mode='F').resize((w, h), Image.BICUBIC)
    return np.asarray(up, dtype=np.float32), p


def embed(img, seed):
    rgb = np.asarray(img.convert('RGB'), dtype=np.float32)
    h, w = rgb.shape[:2]
    up, _ = pattern(seed, w, h)
    lum = Image.fromarray(np.clip(rgb.mean(axis=2), 0, 255).astype(np.uint8), mode='L')
    blur = np.asarray(lum.filter(ImageFilter.GaussianBlur(radius=max(2, w // 400))), dtype=np.float32)
    act = np.abs(np.asarray(lum, dtype=np.float32) - blur)
    # Smooth the activity map (box down, bilinear up; mode 'F' has no blur filters).
    small = Image.fromarray(act, mode='F').resize((max(8, w // 24), max(8, h // 24)), Image.BOX)
    act = np.asarray(small.resize((w, h), Image.BILINEAR), dtype=np.float32)
    mask = 0.6 + 0.8 * np.clip(act / (act.mean() + 1e-3), 0, 2) / 2      # 0.6 … 1.4
    out = rgb + (ALPHA * mask * up)[..., None]
    return Image.fromarray(np.clip(np.rint(out), 0, 255).astype(np.uint8), mode='RGB')


def _ncc_locate(O, T):
    """Best top-left offset of template T inside image O (normalised cross-correlation via FFT)."""
    H, W = O.shape; h, w = T.shape
    t = T - T.mean(); tn = np.sqrt((t * t).sum()) + 1e-6
    F = np.fft.rfft2(O, s=(H + h, W + w)); G = np.fft.rfft2(t[::-1, ::-1], s=(H + h, W + w))
    corr = np.fft.irfft2(F * G, s=(H + h, W + w))[h - 1:H, w - 1:W]
    c1 = np.pad(O, ((1, 0), (1, 0))).cumsum(0).cumsum(1); c2 = np.pad(O * O, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    win = lambda c: c[h:, w:] - c[:-h, w:] - c[h:, :-w] + c[:-h, :-w]
    n = h * w; s1 = win(c1); var = win(c2) - s1 * s1 / n
    score = corr / (np.sqrt(np.maximum(var, 1e-6)) * tn)
    y, x = np.unravel_index(np.argmax(score), score.shape)
    return float(score[y, x]), int(x), int(y)


def locate(suspect, original):
    """Where the (possibly cropped) suspect sits in the original, in original pixels."""
    W, H = original.size
    base = 320.0 / W
    O = np.asarray(original.convert('L').resize((320, max(8, round(H * base))), Image.BOX), dtype=np.float32)
    sw, sh = suspect.size
    best = (-1, 0, 0, 1.0)
    for k in np.linspace(0.55, 1.0, 19):           # suspect covers k × original width
        tw = round(320 * k); th = round(tw * sh / sw)
        if th > O.shape[0] or tw > O.shape[1] or th < 8:
            continue
        T = np.asarray(suspect.convert('L').resize((tw, th), Image.BOX), dtype=np.float32)
        sc, x, y = _ncc_locate(O, T)
        if sc > best[0]:
            best = (sc, x, y, k)
    sc, x, y, k = best
    x0, y0 = x / base, y / base
    bw = 320 * k / base; bh = bw * sh / sw
    return sc, (int(round(x0)), int(round(y0)), int(round(min(W, x0 + bw))), int(round(min(H, y0 + bh))))


def residual_grid(suspect, original):
    """Residual (suspect − original) on the matched region, at pattern-cell scale."""
    W, H = original.size
    ncc, box = locate(suspect, original)
    x0, y0, x1, y1 = box
    bw, bh = max(8, x1 - x0), max(8, y1 - y0)
    a = np.asarray(suspect.convert('L').resize((bw, bh), Image.LANCZOS), dtype=np.float32)
    b = np.asarray(original.convert('L').crop((x0, y0, x0 + bw, y0 + bh)), dtype=np.float32)
    gw, gh = max(4, round(GRID * bw / W)), max(4, round(GRID * bh / H))
    r = np.asarray(Image.fromarray(a - b, mode='F').resize((gw, gh), Image.BOX), dtype=np.float32)
    return {'r': r - r.mean(), 'box': (x0, y0, x0 + bw, y0 + bh), 'grid': (gw, gh), 'ncc': ncc}


def zscore(res, seed, w, h):
    up, _ = pattern(seed, w, h)
    x0, y0, x1, y1 = res['box']
    p = Image.fromarray(np.ascontiguousarray(up[y0:y1, x0:x1]), mode='F').resize(res['grid'], Image.BOX)
    p = np.asarray(p, dtype=np.float32); p = p - p.mean()
    r = res['r']
    return float((r * p).sum() / (r.std() * p.std() * np.sqrt(r.size) + 1e-9))


# ───────── helpers ─────────
def get_item(item_id):
    # Version labels vary: 'v#1', and 'v#v1' on 118 legacy rows.
    it = None
    for sk in ('v#1', 'v#v1'):
        it = ddb.Table(CATALOG).get_item(Key={'pk': f'WALLPAPER#{item_id}', 'sk': sk}).get('Item')
        if it:
            break
    if not it or it.get('hiddenFromPublic') or it.get('archived') or not it.get('fileKey'):
        return None
    return it


def load(key):
    return Image.open(io.BytesIO(s3.get_object(Bucket=ASSETS, Key=key)['Body'].read()))


VIDEO_EXT = ('.mp4', '.mov', '.m4v', '.webm')


def image_keys(it):
    """Cover + carousel slides, images only (videos are not downloadable)."""
    keys = [it['fileKey']] + [k for k in (it.get('slideKeys') or []) if isinstance(k, str) and k]
    return [k for k in keys if not k.lower().endswith(VIDEO_EXT)]


def stitch(keys):
    """Strip post: the strips are one wide artwork cut left→right. Join them
    edge to edge at the smallest strip height."""
    ims = [load(k).convert('RGB') for k in keys]
    h = min(i.size[1] for i in ims)
    ims = [i if i.size[1] == h else i.resize((round(i.size[0] * h / i.size[1]), h), Image.LANCZOS) for i in ims]
    out = Image.new('RGB', (sum(i.size[0] for i in ims), h))
    x = 0
    for i in ims:
        out.paste(i, (x, 0)); x += i.size[0]
    return out


def source_of(rec):
    """The unmarked image a download record was made from."""
    return stitch(rec['srcKeys']) if rec.get('part') == 'full' else load(rec['fileKey'])


def safe_name(it, suffix='', ext='jpg'):
    t = str(it.get('title') or '')
    if len(t) < 4 or t.lower().startswith('mj ') or ' · strip ' in t:
        t = it.get('form') or (it.get('aiSuggestion') or {}).get('form') or 'Darshan'
    t = ''.join(ch if ch.isalnum() or ch in ' -' else ' ' for ch in t).strip()
    t = '-'.join(t.split())[:60] or 'artwork'
    return f'Akara-{t}{suffix}.{ext}'


# ───────── routes ─────────
def marked_record(it, item_id, part, sub, email, prior, now):
    """One fingerprint per person, per artwork, per part. Old records have no
    `part` field: they are the cover, part '0'."""
    rec = next((p for p in prior if p.get('sub') == sub and p.get('s3Key') and str(p.get('part', '0')) == part), None)
    if rec:
        try:
            s3.head_object(Bucket=ASSETS, Key=rec['s3Key'])
            return rec, None
        except Exception:
            rec = None
    keys = image_keys(it)
    wm = secrets.token_hex(8)
    if part == 'full':
        original, src = stitch(keys), {'fileKey': keys[0], 'srcKeys': keys}
    else:
        original, src = load(keys[int(part)]), {'fileKey': keys[int(part)]}
    marked = embed(original, wm)
    buf = io.BytesIO()
    marked.save(buf, 'JPEG', quality=95, subsampling=0, optimize=True)
    key = f"downloads/{datetime.now(timezone.utc):%Y/%m}/{wm}.jpg"
    s3.put_object(Bucket=ASSETS, Key=key, Body=buf.getvalue(), ContentType='image/jpeg')
    rec = {'wmId': wm, 'itemId': item_id, 'sub': sub, 'email': email, 'createdAt': now, 'lastAt': now,
           'downloads': 0, 'views': 0, 'w': original.size[0], 'h': original.size[1],
           's3Key': key, 'algo': 'grid128-a2', 'part': part, **src}
    ddb.Table(DOWNLOADS).put_item(Item=rec)
    return rec, marked


def bump(rec, counter, now):
    ddb.Table(DOWNLOADS).update_item(Key={'wmId': rec['wmId']}, UpdateExpression='ADD #c :one SET lastAt = :t',
                                     ExpressionAttributeNames={'#c': counter}, ExpressionAttributeValues={':one': 1, ':t': now})


def download(event, c):
    """size='full' (default): attachment download. size='display': a 1600px copy
    for the viewer. Both carry the SAME per-person fingerprint (one mark per
    person per artwork part), so even a screenshot of the viewer traces back."""
    body = json.loads(event.get('body') or '{}')
    item_id = str(body.get('id') or '')
    display = body.get('size') == 'display'
    it = get_item(item_id)
    if not it:
        return resp(404, {'ok': False, 'error': 'Not found'})
    keys = image_keys(it)
    part = str(body.get('part', '0'))
    if part != 'full' and not (part.isdigit() and int(part) < len(keys)):
        return resp(400, {'ok': False, 'error': 'Bad part'})
    sub, email = c.get('sub', ''), c.get('email', '')
    now = datetime.now(timezone.utc).isoformat()
    prior = ddb.Table(DOWNLOADS).query(IndexName='ItemIndex', KeyConditionExpression=Key('itemId').eq(item_id)).get('Items', [])

    if body.get('bundle'):
        # Carousel: every image slide, each with its own fingerprint, in one zip.
        recs = [marked_record(it, item_id, str(k), sub, email, prior, now)[0] for k in range(len(keys))]
        zbuf = io.BytesIO()
        with zipfile.ZipFile(zbuf, 'w', zipfile.ZIP_STORED) as z:
            for k, rec in enumerate(recs):
                z.writestr(safe_name(it, f'-{k + 1}'), s3.get_object(Bucket=ASSETS, Key=rec['s3Key'])['Body'].read())
                bump(rec, 'downloads', now)
        tag = hashlib.sha1(''.join(r['wmId'] for r in recs).encode()).hexdigest()[:16]
        zkey = f"downloads/{datetime.now(timezone.utc):%Y/%m}/{tag}.zip"
        s3.put_object(Bucket=ASSETS, Key=zkey, Body=zbuf.getvalue(), ContentType='application/zip')
        fname = safe_name(it, '', 'zip')
        return resp(200, {'ok': True, 'url': presign(zkey, fname, 'application/zip'), 'filename': fname})

    rec, marked = marked_record(it, item_id, part, sub, email, prior, now)
    bump(rec, 'views' if display else 'downloads', now)
    if not display:
        fname = safe_name(it, '' if part in ('0', 'full') else f'-{int(part) + 1}')
        return resp(200, {'ok': True, 'url': presign(rec['s3Key'], fname), 'filename': fname})

    dkey = rec['s3Key'][:-4] + '_d.jpg'
    try:
        s3.head_object(Bucket=ASSETS, Key=dkey)
    except Exception:
        if marked is None:
            marked = Image.open(io.BytesIO(s3.get_object(Bucket=ASSETS, Key=rec['s3Key'])['Body'].read()))
        d = marked.convert('RGB'); d.thumbnail((1600, 1600), Image.LANCZOS)
        buf = io.BytesIO(); d.save(buf, 'JPEG', quality=86, optimize=True)
        s3.put_object(Bucket=ASSETS, Key=dkey, Body=buf.getvalue(), ContentType='image/jpeg')
    url = s3.generate_presigned_url('get_object', Params={'Bucket': ASSETS, 'Key': dkey, 'ResponseContentType': 'image/jpeg'}, ExpiresIn=3600)
    return resp(200, {'ok': True, 'url': url})


def presign(key, fname, ctype='image/jpeg'):
    return s3.generate_presigned_url('get_object', Params={
        'Bucket': ASSETS, 'Key': key,
        'ResponseContentDisposition': f'attachment; filename="{fname}"',
        'ResponseContentType': ctype}, ExpiresIn=600)


def dhash(img):
    g = np.asarray(img.convert('L').resize((9, 8), Image.LANCZOS), dtype=np.int16)
    bits = (g[:, 1:] > g[:, :-1]).flatten()
    return int(''.join('1' if b else '0' for b in bits), 2)


def find(event, c):
    if not is_admin(c):
        return resp(403, {'ok': False, 'error': 'Admin only'})
    body = json.loads(event.get('body') or '{}')
    raw = str(body.get('image') or '')
    if ',' in raw[:80]:
        raw = raw.split(',', 1)[1]
    suspect = Image.open(io.BytesIO(base64.b64decode(raw)))
    item_ids = [body['itemId']] if body.get('itemId') else []
    if not item_ids:
        # Which artwork is it? Compare against the dHash index of catalog previews.
        idx = json.loads(s3.get_object(Bucket=ASSETS, Key='darshan/dhash-index.json')['Body'].read())
        h = dhash(suspect)
        ranked = sorted(((bin(h ^ int(v, 16)).count('1'), k) for k, v in idx.items()))
        item_ids = [k for d, k in ranked[:3] if d <= 12]
        if not item_ids:
            return resp(200, {'ok': True, 'matches': [], 'note': 'No catalog artwork looks like this image.'})
    table = ddb.Table(DOWNLOADS)
    results = []
    for item_id in item_ids:
        recs = table.query(IndexName='ItemIndex', KeyConditionExpression=Key('itemId').eq(item_id)).get('Items', [])
        if not recs:
            results.append({'itemId': item_id, 'candidates': 0, 'matches': []})
            continue
        # Each part (cover, slide k, joined strip) has its own source image:
        # test the suspect against every part's records separately.
        groups = {}
        for x in recs:
            groups.setdefault((str(x.get('part', '0')), x['fileKey']), []).append(x)
        scored = []
        for _, grp in groups.items():
            original = source_of(grp[0])
            r = residual_grid(suspect, original)
            w, h = original.size
            scored += [{'wmId': x['wmId'], 'email': x.get('email', ''), 'sub': x.get('sub', ''), 'part': str(x.get('part', '0')),
                        'createdAt': x.get('createdAt'), 'z': round(zscore(r, x['wmId'], w, h), 1)} for x in grp]
        scored.sort(key=lambda m: -m['z'])
        results.append({'itemId': item_id, 'candidates': len(recs),
                        'matches': [m for m in scored if m['z'] >= Z_MATCH], 'top': scored[:3]})
    return resp(200, {'ok': True, 'threshold': Z_MATCH, 'results': results})


def handler(event, context):
    rc = event.get('requestContext') or {}
    method = (rc.get('http') or {}).get('method') or event.get('httpMethod')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}
    path = event.get('rawPath') or event.get('path') or ''
    c = claims(event)
    if not c:
        return resp(401, {'ok': False, 'error': 'Sign in required'})
    try:
        if path.endswith('/find'):
            return find(event, c)
        return download(event, c)
    except Exception as e:
        print('ERROR', repr(e))
        return resp(500, {'ok': False, 'error': 'Internal error'})
