"""darshan_enrich — new uploads join Darśana on their own.

Started by akara-post-catalog the moment a wallpaper is posted, and every
10 minutes by EventBridge as the backup. Reserved concurrency is 1, so two
runs never tag the same post or overwrite each other's search index. For each catalog wallpaper with no
aiSuggestion yet (i.e. uploaded since the last run) whose watermarked preview
exists:
  1. 480px WebP card picture (previews-sm/)          — same as scripts/darshan_thumbs.py
     + clean copies for signed-in members (originals/sm/, cover + slides)
                                                      — same as scripts/darshan_thumbs.py
  2. dominant colours + accent                        — same as scripts/darshan_suggest.py
  3. Claude names/tags it: title, form, caption, deities, couple, bhava, mood,
     tags, stories (hints: iOS caption + iOS deity tags)
     RULE (owner, 2026-10-11): Claude sees the WHOLE post, never only the cover.
     A strip post is one artwork cut into strips → joined back left→right into
     one panorama. A carousel post → cover + up to 5 slides as separate images.
     (Before this, only the cover went in: a 3-strip Trimurti/Ādi Śakti post was
     captioned "Brahma" only.) See whole_post().
  4. AUTO-APPROVED (owner's rule, 2026-10-08). needsCheck = true when confidence
     is not high, or when the AI's deities disagree with the iOS app's tag.
  5. Nova picture + text vectors appended to darshan/search-index.json
  6. refreshes the Darśana catalog snapshot
  6b. UNIQUE NAMES (owner, 2026-10-11): each work's page link is made from its full
     title (/darshan/art/{slug}, darshan_snapshot/pages.js), so no two public works may
     share a title. A clash → Claude is asked for a different line (twice at most).
  7. NEW DEITIES: anything Claude sees that the list lacks is added on its own —
     see deity_registry.py (registry, /darshan/{slug} page, backfill of old posts).
"""
import base64, colorsys, hashlib, io, json, os, time
from datetime import datetime, timezone
from decimal import Decimal

import boto3
import numpy as np
from boto3.dynamodb.conditions import Key
from PIL import Image
import anthropic

import deity_registry as dr

REGION = os.environ.get('AWS_REGION', 'us-east-1')
ASSETS = os.environ['ASSETS_BUCKET']
TABLE = os.environ.get('CATALOG_TABLE', 'akara-catalog')
SNAPSHOT_FN = os.environ.get('SNAPSHOT_FN', 'akara-darshan-snapshot')
MODEL = os.environ.get('CLAUDE_MODEL', 'claude-opus-5-5')
EMBED = 'amazon.nova-2-multimodal-embeddings-v1:0'
MAX_PER_RUN = int(os.environ.get('MAX_PER_RUN', '12'))

s3 = boto3.client('s3', region_name=REGION)
ddb = boto3.resource('dynamodb', region_name=REGION).Table(TABLE)
br = boto3.client('bedrock-runtime', region_name=REGION)
lam = boto3.client('lambda', region_name=REGION)
VOCAB = json.load(open(os.path.join(os.path.dirname(__file__), 'vocab.json'), encoding='utf-8'))
DEITIES = [d['name'] for d in VOCAB['deities']]          # core list; the run adds the registry's (deity_registry.py)
try: _AL = json.load(open(os.path.join(os.path.dirname(__file__), 'aliases.json'), encoding='utf-8'))
except Exception: _AL = {}
ALIASES_CORE = (_AL.get('deity') or {})                  # aliases.json is {deity:{Name:[spellings]}, story:…}
STORIES = {s['slug']: s for s in VOCAB['stories']}
COUPLES = ['radha-krishna', 'shiva-parvati', 'sita-rama', 'lakshmi-narayana']
BHAVAS = ['saumya', 'ugra', 'shringara', 'vira', 'dhyana']
MOODS = ['devotional', 'cosmic', 'serene', 'fierce', 'joyful', 'mystical', 'contemplative']

def make_schema(deities):
    return {'type': 'object', 'additionalProperties': False,
          'required': ['form', 'title', 'caption', 'deities', 'newDeities', 'couple', 'bhava', 'moodTag', 'tags', 'stories', 'confidence', 'reason'],
          'properties': {'form': {'type': 'string'}, 'title': {'type': 'string'}, 'caption': {'type': 'string'},
                         'deities': {'type': 'array', 'items': {'type': 'string', 'enum': deities}},
                         'newDeities': {'type': 'array', 'items': {'type': 'string'}},
                         'couple': {'type': 'string', 'enum': COUPLES + ['']}, 'bhava': {'type': 'string', 'enum': BHAVAS},
                         'moodTag': {'type': 'string', 'enum': MOODS}, 'tags': {'type': 'array', 'items': {'type': 'string'}},
                         'stories': {'type': 'array', 'items': {'type': 'string', 'enum': list(STORIES)}},
                         'confidence': {'type': 'string', 'enum': ['high', 'medium', 'low']}, 'reason': {'type': 'string'}}}
SCHEMA = make_schema(DEITIES)
STORY_LIST = '\n'.join(f"- {s['slug']}: {s['title']} — {s['en']}" for s in VOCAB['stories'])
SYSTEM = f"""You catalogue Hindu devotional AI-art wallpapers for akara.studio, a devotional broadsheet-style art site. Evidence order: the IMAGE decides; the owner's caption/hashtags are a strong hint; the iOS app's deity tag is a weak hint (often wrong).

- form: the specific form or scene ("Nataraja", "Bal Hanuman", "Anantashayana", "Radha–Krishna Raas"); plain deity name only if no specific form.
- title: exactly "<form> — <short poetic line>", max 60 chars, devotional editorial register. Never a filename or "MJ".
- caption: one devotional line, max 140 chars, describing what is shown — the whole post, not only its first part.
- deities: ONLY deities actually depicted, across EVERY image / every part of the panorama you are given. Empty if unsure. Murugan = Kartikeya/Skanda. Devi = unnamed goddess.
- newDeities: a Hindu deity CLEARLY depicted (or named by the owner AND visible) that is NOT in the deities list — plain English name, e.g. "Brahma". Almost always empty. Never a sage, demon, object or a mere form of a listed deity (Nataraja → Shiva).
- couple: only when that divine couple is shown together, else "".
- bhava: saumya gentle · ugra fierce · shringara loving · vira heroic · dhyana meditative.
- tags: 4-8 lowercase kebab-case tags.
- stories: 0-2 slugs, only when the episode is clearly shown (or the caption names it and the picture agrees):
{STORY_LIST}
- confidence: how sure you are about the deity identification."""


def preview_key(it):
    k = it['fileKey'].lstrip('/'); base = k.split('/')[-1].rsplit('.', 1)[0]
    return (f'previews/{base}.jpg' if k.startswith('originals/') else k), base


def colours(img, k=8):
    q = img.convert('RGB').resize((96, 96)).quantize(colors=k, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[:k * 3]; counts = sorted(q.getcolors(), reverse=True); total = sum(c for c, _ in counts)
    out = [{'hex': '#%02x%02x%02x' % tuple(pal[i * 3:i * 3 + 3]), 'pct': Decimal(str(round(c / total, 3)))} for c, i in counts]
    best, score = None, -1
    for c in out:
        if float(c['pct']) < .05: continue
        r, g, b = (int(c['hex'][i:i + 2], 16) / 255 for i in (1, 3, 5)); h, l, s = colorsys.rgb_to_hls(r, g, b)
        sc = s * (1 - abs(l - .5) * 2)
        if sc > score: best, score = c['hex'], sc
    return out, best


def load_preview(k, context, wait=True):
    """Watermarked preview of one originals/ key, or None. Waits for akara-generate-preview."""
    k = str(k or '').lstrip('/'); base = k.split('/')[-1].rsplit('.', 1)[0]
    pk = f'previews/{base}.jpg' if k.startswith('originals/') else k
    for _ in range(6 if wait else 1):
        try:
            im = Image.open(io.BytesIO(s3.get_object(Bucket=ASSETS, Key=pk)['Body'].read())); im.load(); return im
        except Exception: pass
        if not wait or context.get_remaining_time_in_millis() < 120000: break
        time.sleep(5)
    return None


def whole_post(it, cover, context):
    """What Claude must look at: every picture in the post (owner rule 2026-10-11).
    Returns (images, note). strip → one joined panorama; carousel → cover + up to 5 slides."""
    slides = [x for x in (load_preview(k, context) for k in (it.get('slideKeys') or [])) if x is not None]
    if not slides:
        return [cover], ''
    n = 1 + len(slides)
    if it.get('layout') == 'carousel':
        return [cover] + slides[:5], f"This post is a CAROUSEL of {n} separate images (cover first). Tag deities shown in ANY of them."
    parts = [p.convert('RGB') for p in [cover] + slides]
    h = min(p.height for p in parts)
    parts = [p.resize((max(1, round(p.width * h / p.height)), h)) for p in parts]
    pano = Image.new('RGB', (sum(p.width for p in parts), h)); x = 0
    for p in parts: pano.paste(p, (x, 0)); x += p.width
    return [pano], f"This post is a STRIP CUT: one artwork cut into {n} vertical strips, shown here joined back left to right. Describe and tag the WHOLE panorama, not only its left part."


def suggest(client, it, imgs, note='', schema=None):
    content = []
    for img in imgs:
        b = io.BytesIO(); im = img.convert('RGB'); im.thumbnail((1600, 1000) if len(imgs) == 1 else (800, 800)); im.save(b, 'JPEG', quality=85)
        content.append({'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': base64.b64encode(b.getvalue()).decode()}})
    ctx = '\n'.join(filter(None, [note, f"current title: {it.get('title', '')}", f"owner caption: {str(it.get('caption', ''))[:500]}",
                                   f"iOS deity tag (weak hint): {it.get('deities') or []}"]))
    r = client.messages.create(model=MODEL, max_tokens=4000, system=SYSTEM,
                               output_config={'effort': 'medium', 'format': {'type': 'json_schema', 'schema': schema or SCHEMA}},
                               messages=[{'role': 'user', 'content': content + [{'type': 'text', 'text': ctx}]}])
    if r.stop_reason == 'refusal':
        return None
    return json.loads(next(x.text for x in r.content if x.type == 'text'))


def embed(body):
    r = br.invoke_model(modelId=EMBED, body=json.dumps({'taskType': 'SINGLE_EMBEDDING', 'singleEmbeddingParams': dict(embeddingPurpose='GENERIC_INDEX', embeddingDimension=1024, **body)}))
    v = np.array(json.loads(r['body'].read())['embeddings'][0]['embedding'], dtype=np.float32)
    return base64.b64encode((v / (np.linalg.norm(v) + 1e-9)).astype(np.float16).tobytes()).decode()


def text_doc(s):
    parts = [s['title'], s['form'], s['caption']] + s['deities'] + [s['couple'].replace('-', ' '), s['bhava']]
    for slug in s['stories']:
        st = STORIES.get(slug)
        if st: parts.append(f"{st['title']} {st['en']} {' '.join(st['aka'])}")
    return '. '.join(p for p in parts if p)


def title_key(t):
    return ''.join(c for c in str(t or '').lower() if c.isalnum())


def clean_thumbs(it):
    # No watermark, behind the originals' signed cookies. The key has no extension
    # on purpose: akara-generate-preview skips it instead of making a junk preview.
    for k in [it['fileKey']] + list(it.get('slideKeys') or []):
        k = str(k or '').lstrip('/')
        if not k.startswith('originals/') or k.rsplit('.', 1)[-1].lower() in ('mp4', 'mov', 'm4v', 'webm'):
            continue
        im = Image.open(io.BytesIO(s3.get_object(Bucket=ASSETS, Key=k)['Body'].read())).convert('RGB')
        im.thumbnail((480, 1440)); b = io.BytesIO(); im.save(b, 'WEBP', quality=78, method=5)
        s3.put_object(Bucket=ASSETS, Key='originals/sm/' + k.split('/')[-1].rsplit('.', 1)[0], Body=b.getvalue(), ContentType='image/webp', CacheControl='max-age=31536000, immutable')


def handler(event, context):
    items, kw = [], dict(IndexName='TypeIndex', KeyConditionExpression=Key('type').eq('wallpaper'), ScanIndexForward=False)
    while True:
        r = ddb.query(**kw); items += r['Items']
        if 'LastEvaluatedKey' not in r: break
        kw['ExclusiveStartKey'] = r['LastEvaluatedKey']
    if isinstance(event, dict) and event.get('addDeity'):
        key = boto3.client('ssm', region_name=REGION).get_parameter(Name='/akara/anthropic/key', WithDecryption=True)['Parameter']['Value']
        reg = dr.load(s3, ASSETS)
        _, rep_ = dr.add_deity(anthropic.Anthropic(api_key=key), MODEL, s3, ddb, ASSETS, VOCAB, reg, ALIASES_CORE, str(event['addDeity']), 'manual')
        lam.invoke(FunctionName=SNAPSHOT_FN, InvocationType='Event')
        print(json.dumps({'addDeity': rep_})); return {'ok': True, 'addDeity': rep_}
    todo = [i for i in items if 'aiSuggestion' not in i and (i.get('mediaType') or 'image') == 'image' and i.get('fileKey')
            and not i.get('hiddenFromPublic') and ' · strip ' not in str(i.get('title', ''))][:MAX_PER_RUN]
    if not todo:
        return {'ok': True, 'processed': 0}
    key = boto3.client('ssm', region_name=REGION).get_parameter(Name='/akara/anthropic/key', WithDecryption=True)['Parameter']['Value']
    client = anthropic.Anthropic(api_key=key)
    reg = dr.load(s3, ASSETS)
    schema = make_schema(dr.all_names(VOCAB, reg))
    new_deities = []
    try: index = json.loads(s3.get_object(Bucket=ASSETS, Key='darshan/search-index.json')['Body'].read())
    except Exception: index = {'model': EMBED, 'dim': 1024, 'items': []}
    done = []
    # Titles already used by public works (a work's link is made from its title).
    taken = {title_key(i.get('title')) for i in items if not i.get('hiddenFromPublic') and 'aiSuggestion' in i}
    for it in todo:
        pk, base = preview_key(it)
        img = None
        # The preview Lambda finishes ~3 s after the upload; a post-catalog trigger can beat it.
        for _ in range(6):
            try: img = Image.open(io.BytesIO(s3.get_object(Bucket=ASSETS, Key=pk)['Body'].read())); img.load(); break
            except Exception: img = None
            if context.get_remaining_time_in_millis() < 120000: break
            time.sleep(5)
        if img is None:
            continue                                    # preview not made yet — next run
        try:
            th = img.convert('RGB'); th.thumbnail((480, 1440)); b = io.BytesIO(); th.save(b, 'WEBP', quality=78, method=5)
            s3.put_object(Bucket=ASSETS, Key=f'previews-sm/{base}.webp', Body=b.getvalue(), ContentType='image/webp', CacheControl='public, max-age=31536000, immutable')
            try: clean_thumbs(it)
            except Exception as e: print('clean thumbs failed', it['pk'], repr(e))   # cards fall back to the watermarked one
            cols, accent = colours(img)
            imgs, note = whole_post(it, img, context)
            s = suggest(client, it, imgs, note, schema)
            if not s: continue
            for _ in range(2):
                if title_key(s['title']) not in taken: break
                print('title taken, asking again:', s['title'])
                s2 = suggest(client, it, imgs, (note + '\n' if note else '') + f'"{s["title"]}" is already the title of another work in the gallery. '
                             'Keep the form, but write a different short poetic line after the em dash, true to THIS image.', schema)
                if not s2: break
                s = s2
            taken.add(title_key(s['title']))
            # A deity the list lacks → registry + page + backfill, then tag this post (deity_registry.py).
            for nd in (s.get('newDeities') or [])[:2] if s['confidence'] == 'high' else []:
                try:
                    canon, rep_ = dr.add_deity(client, MODEL, s3, ddb, ASSETS, VOCAB, reg, ALIASES_CORE, nd, it['pk'].split('#')[1])
                    new_deities.append(rep_)
                    if canon and canon not in s['deities']: s['deities'].append(canon)
                except Exception as e: print('add deity failed', nd, repr(e))
            schema = make_schema(dr.all_names(VOCAB, reg))
            s['deities'] = s['deities'][:4]; s['stories'] = [x for x in s['stories'] if x in STORIES][:2]; s['tags'] = [t.lower() for t in s['tags']][:8]
            ios = [d for d in (it.get('deities') or []) if d]
            check = s['confidence'] != 'high' or bool(ios and not set(ios) & set(s['deities']))
            now = datetime.now(timezone.utc).isoformat()
            ddb.update_item(Key={'pk': it['pk'], 'sk': it['sk']},
                UpdateExpression='SET aiSuggestion = :s, aiSuggestedAt = :now, colors = :c, accentColor = :a, title = :t, caption = :cap, deities = :d, form = :f, couple = :cp, bhava = :b, moodTag = :m, tags = :tg, stories = :st, organizedAt = :now, autoApproved = :true, autoApprovedConfidence = :conf, needsCheck = :nc, iosDeities = :ios, previousTitle = :pt, updatedAt = :now',
                ExpressionAttributeValues={':s': s, ':now': now, ':c': cols, ':a': accent, ':t': s['title'], ':cap': s['caption'], ':d': s['deities'], ':f': s['form'], ':cp': s['couple'], ':b': s['bhava'], ':m': s['moodTag'], ':tg': s['tags'], ':st': s['stories'], ':true': True, ':conf': s['confidence'], ':nc': check, ':ios': ios, ':pt': it.get('title', '')})
            jb = io.BytesIO(); th.save(jb, 'JPEG', quality=88)
            iid = it['pk'].split('#')[1]
            index['items'] = [r for r in index['items'] if r['id'] != iid] + [{'id': iid, 'h': hashlib.sha1(text_doc(s).encode()).hexdigest()[:12],
                'txt': embed({'text': {'truncationMode': 'END', 'value': text_doc(s)}}), 'img': embed({'image': {'format': 'jpeg', 'source': {'bytes': base64.b64encode(jb.getvalue()).decode()}}})}]
            done.append({'id': iid, 'title': s['title'], 'needsCheck': check})
        except Exception as e:
            print('enrich failed', it['pk'], repr(e))
    if done:
        s3.put_object(Bucket=ASSETS, Key='darshan/search-index.json', Body=json.dumps(index), ContentType='application/json')
        lam.invoke(FunctionName=SNAPSHOT_FN, InvocationType='Event')
    print(json.dumps({'processed': done, 'newDeities': new_deities}))
    return {'ok': True, 'processed': len(done), 'items': done, 'newDeities': new_deities}
