"""Darśana retro pass: AI name/deity/bhava suggestions + dominant colours for
every catalog wallpaper.

Writes two ADDITIVE fields onto each `akara-catalog` wallpaper row:
  aiSuggestion  — map shown in admin Organize; nothing public changes until the
                  owner approves it there.
  colors        — [{hex, pct}] dominant colours, computed by code (no AI).

Hints, strongest first: the image, the social caption of the same iOS item
(linked through the `website` row in akara-posts, platformPostId = catalog id),
then the original Midjourney prompt (title "MJ <jobId8>" -> akara-mj-archive).

Usage:
  python darshan_suggest.py --limit 5 --dry-run     # print, write nothing
  python darshan_suggest.py                          # all items lacking aiSuggestion
  python darshan_suggest.py --force                  # redo everything
"""
import argparse, base64, io, json, collections, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key, Attr
from PIL import Image
import anthropic

REGION = 'us-east-1'
ASSETS = 'akara-assets-738983679688-us-east-1'
MODEL = 'claude-opus-5-5'

DEITIES = ['Shiva', 'Krishna', 'Ganesha', 'Hanuman', 'Devi', 'Durga', 'Kali', 'Lakshmi',
           'Saraswati', 'Vishnu', 'Rama', 'Narasimha', 'Murugan', 'Surya',
           'Radha', 'Parvati', 'Sita']
COUPLES = ['radha-krishna', 'shiva-parvati', 'sita-rama', 'lakshmi-narayana']
BHAVAS = ['saumya', 'ugra', 'shringara', 'vira', 'dhyana']
MOODS = ['devotional', 'cosmic', 'serene', 'fierce', 'joyful', 'mystical', 'contemplative']

SCHEMA = {
    'type': 'object',
    'properties': {
        'form': {'type': 'string'},
        'title': {'type': 'string'},
        'caption': {'type': 'string'},
        'deities': {'type': 'array', 'items': {'type': 'string', 'enum': DEITIES}},
        'couple': {'type': 'string', 'enum': COUPLES + ['']},
        'bhava': {'type': 'string', 'enum': BHAVAS},
        'moodTag': {'type': 'string', 'enum': MOODS},
        'tags': {'type': 'array', 'items': {'type': 'string'}},
        'confidence': {'type': 'string', 'enum': ['high', 'medium', 'low']},
        'reason': {'type': 'string'},
    },
    'required': ['form', 'title', 'caption', 'deities', 'couple', 'bhava', 'moodTag',
                 'tags', 'confidence', 'reason'],
    'additionalProperties': False,
}

SYSTEM = f"""You catalogue Hindu devotional AI-art wallpapers for akara.studio, a devotional broadsheet-style art site. For each IMAGE you get optional hints. Return clean catalogue metadata.

Evidence order: the IMAGE decides. Then the owner's social caption/hashtags (written when the art was posted — usually names the form correctly). The Midjourney prompt is the weakest hint: it is sometimes for a different image. When hints disagree with what you see, trust the image and say so in `reason`.

Fields:
- form: the specific form or scene, e.g. "Nataraja", "Bal Hanuman", "Ardhanarishvara", "Vishwaroopa", "Anantashayana", "Radha–Krishna Raas", "Mahishasuramardini". Use the plain deity name only if no specific form is visible.
- title: exactly "<form> — <short poetic line>", max 60 chars, devotional editorial register. Never a filename, job id or "MJ".
- caption: one devotional line, max 140 chars, describing what is shown.
- deities: ONLY deities actually depicted, from the list. Empty if unsure — never guess. Murugan = Kartikeya/Skanda. Devi = unnamed goddess.
- couple: set only when the image is that divine couple together; else "".
- bhava (mood of the depiction): saumya = gentle, benevolent; ugra = fierce, wrathful; shringara = love, beauty, tenderness; vira = heroic, battle, power in action; dhyana = meditative, still, inward.
- moodTag: the iOS app's mood lattice.
- tags: 4-8 lowercase kebab-case tags (subject, setting, style).
- Iconography: Shiva (third eye, crescent, trident, serpent, ash), Krishna (blue/dark skin, flute, peacock feather), Vishnu (four arms, conch, chakra, mace, lotus; Anantashayana = reclining on Shesha), Ganesha (elephant head), Hanuman (vanara, gada), Rama (bow, often with Sita/Lakshmana), Narasimha (lion face), Durga (lion/tiger mount, many weapons), Kali (dark, tongue out, garland of heads), Lakshmi (lotus, gold coins), Saraswati (veena, white swan), Radha (beside Krishna), Parvati (beside Shiva), Surya (sun disc, chariot of seven horses)."""


def dominant_colors(img, k=8):
    small = img.convert('RGB').resize((96, 96))
    q = small.quantize(colors=k, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[:k * 3]
    counts = sorted(q.getcolors(), reverse=True)
    total = sum(c for c, _ in counts)
    out = []
    for c, idx in counts:
        r, g, b = pal[idx * 3: idx * 3 + 3]
        out.append({'hex': f'#{r:02x}{g:02x}{b:02x}', 'pct': Decimal(str(round(c / total, 3)))})
    return out


def accent_color(colors):
    # Most saturated colour that covers >=5% — what the colour wheel matches on,
    # so a grey sky doesn't drown a saffron robe.
    import colorsys
    best, best_s = None, -1
    for c in colors:
        if float(c['pct']) < 0.05:
            continue
        r, g, b = (int(c['hex'][i:i + 2], 16) / 255 for i in (1, 3, 5))
        h, l, s = colorsys.rgb_to_hls(r, g, b)
        score = s * (1 - abs(l - 0.5) * 2)
        if score > best_s:
            best, best_s = c['hex'], score
    return best


def load_image(s3, item):
    uuid = item['fileKey'].split('/')[-1].rsplit('.', 1)[0]
    for key in (f'previews/{uuid}.jpg', item['fileKey']):
        try:
            data = s3.get_object(Bucket=ASSETS, Key=key)['Body'].read()
            img = Image.open(io.BytesIO(data))
            img.load()
            return img
        except Exception:
            continue
    return None


def to_jpeg_b64(img):
    im = img.convert('RGB')
    im.thumbnail((1200, 1200))
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=85)
    return base64.standard_b64encode(buf.getvalue()).decode()


def build_hints(posts, mj):
    by_media = collections.defaultdict(list)
    cat2media = {}
    for p in posts:
        by_media[p.get('mediaItemId') or p.get('contentId')].append(p)
        if p.get('platform') == 'website' and p.get('platformPostId'):
            cat2media[p['platformPostId']] = p['mediaItemId']
    mj_by_prefix = {m['jobId'][:8]: m for m in mj}
    return by_media, cat2media, mj_by_prefix


def hints_for(item, by_media, cat2media, mj_by_prefix):
    cid = item['pk'].split('#')[1]
    h = {}
    mid = cat2media.get(cid)
    if mid:
        soc = [p for p in by_media[mid]
               if p.get('platform') in ('twitter', 'instagram', 'pinterest') and p.get('caption')]
        if soc:
            best = max(soc, key=lambda p: len(p.get('caption', '')))
            h['social_caption'] = best['caption'][:700]
            h['hashtags'] = best.get('hashtags', '')
            tw = [p for p in soc if p.get('platform') == 'twitter' and p.get('platformUrl')]
            if tw:
                h['tweet_url'] = tw[0]['platformUrl']
    t = str(item.get('title', ''))
    if t.lower().startswith('mj ') and len(t.split()) > 1:
        m = mj_by_prefix.get(t.split()[1][:8])
        if m:
            h['mj_prompt'] = (m.get('rawPrompt') or m.get('textSubject') or '')[:500]
    return h


def suggest(client, item, img, hints):
    text = '\n'.join(filter(None, [
        f"current title: {item.get('title', '')}",
        f"current caption: {str(item.get('caption', ''))[:200]}",
        f"existing deities: {item.get('deities') or []}",
        f"social caption (strong hint): {hints['social_caption']}" if hints.get('social_caption') else '',
        f"hashtags: {hints['hashtags']}" if hints.get('hashtags') else '',
        f"midjourney prompt (weak hint): {hints['mj_prompt']}" if hints.get('mj_prompt') else '',
    ]))
    content = [{'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg',
                                            'data': to_jpeg_b64(img)}},
               {'type': 'text', 'text': text}]
    for attempt in range(3):
        try:
            resp = client.messages.create(
                model=MODEL, max_tokens=4000, system=SYSTEM,
                output_config={'effort': 'medium',
                               'format': {'type': 'json_schema', 'schema': SCHEMA}},
                messages=[{'role': 'user', 'content': content}],
            )
            if resp.stop_reason == 'refusal':
                return None
            txt = next(b.text for b in resp.content if b.type == 'text')
            return json.loads(txt)
        except anthropic.RateLimitError:
            time.sleep(10 * (attempt + 1))
        except anthropic.APIStatusError as e:
            if e.status_code >= 500:
                time.sleep(5)
                continue
            raise
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--workers', type=int, default=8)
    args = ap.parse_args()

    ddb = boto3.resource('dynamodb', region_name=REGION)
    s3 = boto3.client('s3', region_name=REGION)
    key = boto3.client('ssm', region_name=REGION).get_parameter(
        Name='/akara/anthropic/key', WithDecryption=True)['Parameter']['Value']
    client = anthropic.Anthropic(api_key=key)

    cat = ddb.Table('akara-catalog')
    items, kw = [], dict(IndexName='TypeIndex', KeyConditionExpression=Key('type').eq('wallpaper'))
    while True:
        r = cat.query(**kw)
        items += r['Items']
        if 'LastEvaluatedKey' not in r:
            break
        kw['ExclusiveStartKey'] = r['LastEvaluatedKey']

    def scan(name):
        t, out, k = ddb.Table(name), [], {}
        while True:
            r = t.scan(**k)
            out += r['Items']
            if 'LastEvaluatedKey' not in r:
                return out
            k['ExclusiveStartKey'] = r['LastEvaluatedKey']

    by_media, cat2media, mj_by_prefix = build_hints(scan('akara-posts'), scan('akara-mj-archive'))

    todo = [i for i in items if i.get('mediaType', 'image') == 'image'
            and (args.force or 'aiSuggestion' not in i)]
    # MJ junk titles first, so a partial run still covers the worst names.
    todo.sort(key=lambda i: not str(i.get('title', '')).lower().startswith('mj '))
    if args.limit:
        todo = todo[:args.limit]
    print(f'{len(items)} wallpapers, {len(todo)} to process', flush=True)

    def work(item):
        img = load_image(s3, item)
        if img is None:
            return item, None, None, 'no image'
        h = hints_for(item, by_media, cat2media, mj_by_prefix)
        colors = dominant_colors(img)
        s = suggest(client, item, img, h)
        if s is None:
            return item, None, colors, 'no suggestion'
        s['hints'] = sorted(h.keys())
        if h.get('tweet_url'):
            s['tweetUrl'] = h['tweet_url']
        return item, s, colors, None

    done = failed = 0
    with ThreadPoolExecutor(args.workers) as ex:
        for fut in as_completed([ex.submit(work, i) for i in todo]):
            try:
                item, s, colors, err = fut.result()
            except Exception as e:
                failed += 1
                print('ERROR', e, flush=True)
                continue
            if args.dry_run:
                print(json.dumps({'old': item.get('title'), 'new': s, 'colors': colors},
                                 ensure_ascii=False, default=str), flush=True)
                continue
            sets, vals = [], {':now': datetime.now(timezone.utc).isoformat()}
            if colors:
                sets += ['colors = :c', 'accentColor = :a']
                vals[':c'] = colors; vals[':a'] = accent_color(colors)
            if s:
                sets += ['aiSuggestion = :s', 'aiSuggestedAt = :now']; vals[':s'] = s
            if sets:
                cat.update_item(Key={'pk': item['pk'], 'sk': item['sk']},
                                UpdateExpression='SET ' + ', '.join(sets),
                                ExpressionAttributeValues=vals)
            if err:
                failed += 1
                print('SKIP', item['pk'], err, flush=True)
            else:
                done += 1
                if done % 25 == 0:
                    print(f'{done} done', flush=True)
    print(f'finished: {done} suggested, {failed} failed/skipped', flush=True)


if __name__ == '__main__':
    main()
