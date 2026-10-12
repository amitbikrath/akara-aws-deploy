"""deity_registry — new deities join Darśana on their own (owner rule, 2026-10-11).

The 17 core deities live in vocab.json (and, for the site, in
frontend/public/akara/darshan/data.js). Every deity added later lives in ONE
registry: s3://ASSETS/darshan/deities.json, served at /content/darshan/deities.json.
Everything reads it at run time:
  - darshan_enrich (this Lambda)  — deity list Claude may tag with
  - darshan.js                     — Darśana filters, page header, search words
  - darshan_search                 — search words → deity
  - organize_catalog               — admin Organize suggestions

How a deity gets in:
  1. Claude tags a new upload. If it clearly sees a deity that is not on the list,
     it names it in `newDeities` (high confidence only).
  2. add_deity() asks Claude for the entry (IAST title, Devanagari, aliases, a
     dek, one well-known śloka with its source), saves it with needsReview=true,
     and writes /darshan/{slug}.html from the shared template.
  3. backfill() tags every OLDER post whose title / caption / iOS tag names the
     deity (whole-word match). It only appends the tag — it never rewrites a
     title or caption.
Manual run: invoke akara-darshan-enrich with {"addDeity": "Brahma"}.
"""
import html, json, re, time
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key

REG_KEY = 'darshan/deities.json'
FRONTEND = 'akara-frontend-738983679688-us-east-1'
TEMPLATE_KEY = 'akara/darshan/template.html'
SITE = 'https://www.akara.studio'

ENTRY_SCHEMA = {'type': 'object', 'additionalProperties': False,
    'required': ['name', 'title', 'sa', 'dek', 'aliases', 'shloka', 'isDeity', 'sameAs'],
    'properties': {
        'isDeity': {'type': 'boolean'}, 'sameAs': {'type': 'string'},
        'name': {'type': 'string'}, 'title': {'type': 'string'}, 'sa': {'type': 'string'},
        'dek': {'type': 'string'},
        'aliases': {'type': 'array', 'items': {'type': 'string'}},
        'shloka': {'type': 'object', 'additionalProperties': False, 'required': ['dev', 'iast', 'en', 'src'],
                   'properties': {'dev': {'type': 'string'}, 'iast': {'type': 'string'}, 'en': {'type': 'string'}, 'src': {'type': 'string'}}}}}

ENTRY_SYSTEM = """You write one deity entry for Darśana, the devotional gallery of akara.studio (a devotional broadsheet: italic deks, Sanskrit terms, calm editorial register).
- sameAs: if this is a form, avatar, epithet or other name of a deity ALREADY in the existing list (e.g. Nataraja → Shiva, Adi Shakti → Devi, Bal Gopal → Krishna), that existing name exactly; else "".
- isDeity: true only for a Hindu deity in their own right who is not in the existing list. False for sages, demons, objects, places, forms of a listed deity, or anything unsure.
- name: plain English canonical name, ASCII, Title Case (e.g. "Brahma").
- title: the name in IAST with diacritics (e.g. "Brahmā").
- sa: the name in Devanagari.
- dek: one sentence, max 160 chars, in the same register as: "Neither man nor lion, at dusk, on the threshold: the form that broke out of a pillar to protect Prahlāda."
- aliases: 3-8 lowercase spellings people search with, Roman and Devanagari (e.g. "bramha", "brahmadev", "ब्रह्मा"). No generic words.
- shloka: ONE well-known, real verse addressed to this deity, with dev (Devanagari), iast, en (plain meaning) and src (the text it is from). Never invent a verse; if unsure, use a widely known nāma-mantra and say so in src."""


def slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def load(s3, assets):
    try:
        return json.loads(s3.get_object(Bucket=assets, Key=REG_KEY)['Body'].read())
    except Exception:
        return {'version': 1, 'deities': []}


def save(s3, assets, reg):
    s3.put_object(Bucket=assets, Key=REG_KEY, Body=json.dumps(reg, ensure_ascii=False, indent=1).encode(),
                  ContentType='application/json', CacheControl='public, max-age=300')


def all_names(vocab, reg):
    return [d['name'] for d in vocab['deities']] + [d['name'] for d in reg['deities']]


def resolve(name, vocab, reg, aliases_core):
    """Existing canonical name for `name` (by name, title or alias), or None."""
    n = name.strip().lower()
    for d in vocab['deities'] + reg['deities']:
        if n in {d['name'].lower(), d.get('title', '').lower(), d.get('sa', '')} | set(a.lower() for a in d.get('aliases', [])):
            return d['name']
    for canon, al in aliases_core.items():
        if n in (a.lower() for a in al):
            return canon
    return None


def _words(entry):
    return sorted({entry['name'].lower(), entry['title'].lower()} | {a.lower() for a in entry.get('aliases', [])}, key=len, reverse=True)


def _mentions(it, words):
    sug = it.get('aiSuggestion') or {}
    txt = ' '.join(str(x) for x in [it.get('title', ''), it.get('caption', ''), it.get('previousTitle', ''),
                                     sug.get('caption', ''), sug.get('form', ''), ' '.join(it.get('iosDeities') or [])]).lower()
    return any(re.search(r'(?<![\wऀ-ॿ])' + re.escape(w) + r'(?![\wऀ-ॿ])', txt) for w in words if w)


def write_page(s3, entry, cover_url):
    tpl = s3.get_object(Bucket=FRONTEND, Key=TEMPLATE_KEY)['Body'].read().decode('utf-8')
    m = {'TITLE': f"{entry['title']} wallpapers · Darśana · Akara",
         'OGTITLE': f"{entry['title']} · Darśana by Akara",
         'DESC': f"{entry['dek']} Devotional {entry['name']} art and ślokas, free full-size downloads.",
         'OG': cover_url or f'{SITE}/akara/vishwaroopa/og-series.jpg', 'OGALT': f"{entry['name']} by Akara",
         'RULE': f"Darśana · Devatā · {entry['title']}", 'URL': f"{SITE}/darshan/{entry['slug']}", 'V': time.strftime('%Y%m%d%H%M')}
    # Same rules as scripts/darshan_pages.py (the display font lacks capital Ś).
    out = tpl.replace('{{WORD}}', html.escape(entry['title']).replace('Ś', '<span class="ac">S</span>'))
    out = out.replace('{{KICK}}', html.escape('Darśana · Devatā'))
    for k, v in m.items():
        out = out.replace('{{' + k + '}}', html.escape(v, quote=True))
    s3.put_object(Bucket=FRONTEND, Key=f"darshan/{entry['slug']}.html", Body=out.encode('utf-8'), ContentType='text/html')


def backfill(ddb, entry):
    """Append the deity to every post that names it. Never rewrites text."""
    items, kw = [], dict(IndexName='TypeIndex', KeyConditionExpression=Key('type').eq('wallpaper'))
    while True:
        r = ddb.query(**kw); items += r['Items']
        if 'LastEvaluatedKey' not in r: break
        kw['ExclusiveStartKey'] = r['LastEvaluatedKey']
    words, tagged, cover = _words(entry), [], None
    for it in items:
        if entry['name'] in (it.get('deities') or []) or not _mentions(it, words):
            if entry['name'] in (it.get('deities') or []) and not cover and it.get('fileKey'):
                cover = it
            continue
        ddb.update_item(Key={'pk': it['pk'], 'sk': it['sk']},
                        UpdateExpression='SET deities = list_append(if_not_exists(deities, :e), :d), deityBackfilledAt = :now',
                        ExpressionAttributeValues={':d': [entry['name']], ':e': [], ':now': datetime.now(timezone.utc).isoformat()})
        tagged.append(it['pk'].split('#')[1])
        if not cover and it.get('fileKey') and not it.get('hiddenFromPublic'):
            cover = it
    return tagged, cover


def add_deity(client, model, s3, ddb, assets, vocab, reg, aliases_core, name, source):
    """Add `name` to the registry (if new), write its page, backfill old posts.
    Returns (canonical name or None, report dict)."""
    have = resolve(name, vocab, reg, aliases_core)
    if have:
        entry = next((d for d in reg['deities'] if d['name'] == have), None)
        if not entry:
            return have, {'name': have, 'status': 'already core'}
    else:
        r = client.messages.create(model=model, max_tokens=3000, system=ENTRY_SYSTEM,
                                   output_config={'effort': 'medium', 'format': {'type': 'json_schema', 'schema': ENTRY_SCHEMA}},
                                   messages=[{'role': 'user', 'content': f"Existing list: {', '.join(all_names(vocab, reg))}\nDeity: {name}"}])
        if r.stop_reason == 'refusal':
            return None, {'name': name, 'status': 'refused'}
        e = json.loads(next(x.text for x in r.content if x.type == 'text'))
        if e['sameAs'] in all_names(vocab, reg):
            return e['sameAs'], {'name': name, 'status': f"form of {e['sameAs']}"}
        if not e['isDeity']:
            return None, {'name': name, 'status': 'not a deity'}
        again = resolve(e['name'], vocab, reg, aliases_core)
        if again:
            return again, {'name': again, 'status': 'alias of existing'}
        e.pop('isDeity'); e.pop('sameAs')
        entry = dict(e, slug=slugify(e['name']), shlokas=[e.pop('shloka')], aliases=[a.lower() for a in e['aliases']][:8],
                     auto=True, needsReview=True, source=source, addedAt=datetime.now(timezone.utc).isoformat())
        reg['deities'].append(entry)
        save(s3, assets, reg)
    tagged, cover = backfill(ddb, entry)
    cover_url = None
    if cover:
        base = cover['fileKey'].split('/')[-1].rsplit('.', 1)[0]
        cover_url = f'{SITE}/content/previews/{base}.jpg'
    write_page(s3, entry, cover_url)
    return entry['name'], {'name': entry['name'], 'slug': entry['slug'], 'status': 'added' if not have else 'refreshed',
                           'backfilled': len(tagged), 'page': f"/darshan/{entry['slug']}"}
