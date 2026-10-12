"""Darśana search: meaning-based search over pictures + text, learning from use.

POST /api/darshan/search  {q, sid}            public  → {strong:[ids], related:[ids]}
POST /api/darshan/event   {sid, q, id, type}  public  → logs open/download; feeds the boost
GET  /api/darshan/search-report               admin   → top / zero-result / no-click searches

Ranking = 0.6 × text similarity + 0.4 × picture similarity (both z-scored across
the catalog, Amazon Nova 2 multimodal embeddings) + exact-name bonuses (deity,
story, title words, incl. Hindi/Hinglish other names) + a learned boost: an
artwork rises for a search once ≥3 different visits opened/downloaded it for
that search; the boost fades over 30 days.
"""
import base64, hashlib, json, os, re, time, unicodedata, urllib.request
from datetime import datetime, timedelta, timezone

import boto3
import numpy as np
from boto3.dynamodb.conditions import Key

REGION = os.environ.get('AWS_REGION', 'us-east-1')
ASSETS = os.environ['ASSETS_BUCKET']
SEARCHES = os.environ.get('SEARCHES_TABLE', 'akara-searches')
BOOST = os.environ.get('BOOST_TABLE', 'akara-search-boost')
CATALOG_URL = os.environ.get('CATALOG_URL', 'https://www.akara.studio/akara/darshan/catalog.json')
MODEL = 'amazon.nova-2-multimodal-embeddings-v1:0'

s3 = boto3.client('s3', region_name=REGION)
br = boto3.client('bedrock-runtime', region_name=REGION)
ddb = boto3.resource('dynamodb', region_name=REGION)
ALIAS = json.load(open(os.path.join(os.path.dirname(__file__), 'aliases.json'), encoding='utf-8'))
CORS = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,authorization'}
_ix = {'t': 0}


def resp(code, body):
    return {'statusCode': code, 'headers': CORS, 'body': json.dumps(body, default=str)}


def plain(s):
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower() if s else ''


def norm_q(q):
    q = re.sub(r'\s+', ' ', str(q or '').strip().lower())[:120]
    return q


def load_index():
    """Index + catalog, cached in memory for 10 minutes."""
    if time.time() - _ix['t'] < 600:
        return _ix
    raw = json.loads(s3.get_object(Bucket=ASSETS, Key='darshan/search-index.json')['Body'].read())
    rows = raw['items']
    dec = lambda s: np.frombuffer(base64.b64decode(s), dtype=np.float16).astype(np.float32)
    cat = {i['id']: i for i in json.load(urllib.request.urlopen(CATALOG_URL, timeout=10))['items']}
    rows = [r for r in rows if r['id'] in cat]
    # Deities the AI added later (darshan_enrich/deity_registry.py): their spellings join the search words.
    try:
        for d in json.loads(s3.get_object(Bucket=ASSETS, Key='darshan/deities.json')['Body'].read()).get('deities', []):
            ALIAS['deity'][d['name']] = sorted({d['name'].lower(), plain(d.get('title', '')), d.get('sa', '')} | {a.lower() for a in d.get('aliases', [])} - {''})
    except Exception as e:
        print('deity registry read failed', repr(e))
    _ix.update(t=time.time(), ids=[r['id'] for r in rows], T=np.stack([dec(r['txt']) for r in rows]), I=np.stack([dec(r['img']) for r in rows]), cat=cat)
    return _ix


def embed(text, purpose):
    r = br.invoke_model(modelId=MODEL, body=json.dumps({'taskType': 'SINGLE_EMBEDDING', 'singleEmbeddingParams': {
        'embeddingPurpose': purpose, 'embeddingDimension': 1024, 'text': {'truncationMode': 'END', 'value': text}}}))
    v = np.array(json.loads(r['body'].read())['embeddings'][0]['embedding'], dtype=np.float32)
    return v / (np.linalg.norm(v) + 1e-9)


def matched_names(q):
    """Deities and stories the query names (any spelling we know)."""
    qp = ' ' + plain(q) + ' '
    qr = ' ' + q + ' '
    hit = lambda names: any((' ' + n + ' ') in qp or (' ' + n + ' ') in qr for n in names)
    deities = [d for d, n in ALIAS['deity'].items() if hit(n)]
    stories = [s for s, n in ALIAS['story'].items() if hit(n)]
    # "hanuman lifting mountain" must not pull in Krishna's Govardhana: when the query
    # names a deity, keep only stories that belong to that deity.
    if deities:
        stories = [s for s in stories if set(ALIAS['storyDeities'].get(s, [])) & set(deities)]
    return deities, stories


def boosts(qn):
    out, now = {}, datetime.now(timezone.utc)
    try:
        for r in ddb.Table(BOOST).query(KeyConditionExpression=Key('qn').eq(qn)).get('Items', []):
            n = len(r.get('visitors') or [])
            if n < 3:
                continue
            age = (now - datetime.fromisoformat(r['lastAt'])).days
            out[r['itemId']] = 0.6 * min(1.0, (n - 2) / 5) * max(0.0, 1 - age / 30)
    except Exception as e:
        print('boost read failed', repr(e))
    return out


def search(event):
    body = json.loads(event.get('body') or '{}')
    q, sid = norm_q(body.get('q')), str(body.get('sid') or '')[:40]
    if len(q) < 2:
        return resp(400, {'ok': False, 'error': 'Query too short'})
    t0 = time.time(); ix = load_index()
    zt = lambda x: (x - x.mean()) / (x.std() + 1e-9)
    st = zt(ix['T'] @ embed(q, 'TEXT_RETRIEVAL'))
    si = zt(ix['I'] @ embed(q, 'IMAGE_RETRIEVAL'))
    score = 0.6 * st + 0.4 * si
    deities, stories = matched_names(q)
    words = [w for w in re.findall(r'[a-z]{4,}', plain(q))]
    learned = boosts(q)
    for k, iid in enumerate(ix['ids']):
        it = ix['cat'][iid]
        if deities and set(deities) & set(it.get('deities') or []): score[k] += 0.9
        if stories and set(stories) & set(it.get('stories') or []): score[k] += 1.6
        tl = plain(it.get('title', '') + ' ' + it.get('form', ''))
        score[k] += 0.25 * sum(1 for w in words if w in tl)
        score[k] += learned.get(iid, 0)
    # When the query names a deity, works without that deity sink (unless a story matched).
    if deities:
        for k, iid in enumerate(ix['ids']):
            it = ix['cat'][iid]
            if not set(deities) & set(it.get('deities') or []) and not (stories and set(stories) & set(it.get('stories') or [])):
                score[k] -= 0.8
    order = np.argsort(-score)
    strong = [ix['ids'][k] for k in order if score[k] >= 1.9][:60]
    if not strong:
        strong = [ix['ids'][k] for k in order[:6] if score[k] >= 1.2]
    related = [ix['ids'][k] for k in order if 0.9 <= score[k] and ix['ids'][k] not in strong][:36]
    ms = int((time.time() - t0) * 1000)
    now = datetime.now(timezone.utc)
    try:
        ddb.Table(SEARCHES).put_item(Item={'pk': 'Q#' + now.strftime('%Y-%m-%d'), 'sk': now.isoformat() + '#' + os.urandom(3).hex(),
            'q': q, 'sid': sid, 'nStrong': len(strong), 'nRelated': len(related), 'top': strong[:8], 'deities': deities, 'stories': stories, 'ms': ms})
    except Exception as e:
        print('log failed', repr(e))
    return resp(200, {'ok': True, 'q': q, 'strong': strong, 'related': related, 'deities': deities, 'stories': stories, 'ms': ms})


def log_event(event):
    b = json.loads(event.get('body') or '{}')
    q, iid, typ, sid = norm_q(b.get('q')), str(b.get('id') or '')[:80], str(b.get('type') or ''), str(b.get('sid') or '')[:40]
    if not q or not iid or typ not in ('open', 'download') or not sid:
        return resp(400, {'ok': False})
    now = datetime.now(timezone.utc)
    ddb.Table(SEARCHES).put_item(Item={'pk': 'E#' + now.strftime('%Y-%m-%d'), 'sk': now.isoformat() + '#' + os.urandom(3).hex(), 'q': q, 'id': iid, 'type': typ, 'sid': sid})
    vh = hashlib.sha1(sid.encode()).hexdigest()[:12]
    ddb.Table(BOOST).update_item(Key={'qn': q, 'itemId': iid},
        UpdateExpression='ADD visitors :v, #c :one SET lastAt = :now',
        ExpressionAttributeNames={'#c': typ + 's'}, ExpressionAttributeValues={':v': {vh}, ':one': 1, ':now': now.isoformat()})
    return resp(200, {'ok': True})


def is_admin(event):
    a = (event.get('requestContext') or {}).get('authorizer') or {}
    c = (a.get('jwt') or {}).get('claims') or a.get('claims') or {}
    g = c.get('cognito:groups', '')
    return 'admin' in (g if isinstance(g, list) else re.split(r'[\s,\[\]]+', str(g)))


def report(event):
    if not is_admin(event):
        return resp(403, {'ok': False, 'error': 'Admin only'})
    days = int(((event.get('queryStringParameters') or {}).get('days')) or 30)
    t, today = ddb.Table(SEARCHES), datetime.now(timezone.utc).date()
    qs, evs = [], []
    for i in range(min(days, 90)):
        day = (today - timedelta(days=i)).isoformat()
        for pref, sink in (('Q#', qs), ('E#', evs)):
            kw = {'KeyConditionExpression': Key('pk').eq(pref + day)}
            while True:
                r = t.query(**kw); sink += r.get('Items', [])
                if 'LastEvaluatedKey' not in r: break
                kw['ExclusiveStartKey'] = r['LastEvaluatedKey']
    agg = {}
    for x in qs:
        a = agg.setdefault(x['q'], {'q': x['q'], 'searches': 0, 'visits': set(), 'zero': 0, 'opens': 0, 'downloads': 0, 'items': {}})
        a['searches'] += 1; a['visits'].add(x.get('sid')); a['zero'] += 1 if int(x.get('nStrong', 0)) == 0 else 0
    for e in evs:
        a = agg.setdefault(e['q'], {'q': e['q'], 'searches': 0, 'visits': set(), 'zero': 0, 'opens': 0, 'downloads': 0, 'items': {}})
        a['opens' if e['type'] == 'open' else 'downloads'] += 1
        a['items'][e['id']] = a['items'].get(e['id'], 0) + 1
    rows = []
    for a in agg.values():
        a['visits'] = len(a['visits']); a['items'] = sorted(a['items'].items(), key=lambda kv: -kv[1])[:6]; rows.append(a)
    rows.sort(key=lambda a: -a['searches'])
    return resp(200, {'ok': True, 'days': days, 'totalSearches': len(qs), 'top': rows[:50],
        'zeroResults': [a for a in rows if a['zero'] and a['zero'] == a['searches']][:50],
        'noClicks': [a for a in rows if a['searches'] >= 2 and a['opens'] == 0][:50]})


def handler(event, context):
    rc = event.get('requestContext') or {}
    method = (rc.get('http') or {}).get('method') or event.get('httpMethod')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}
    path = event.get('rawPath') or event.get('path') or ''
    try:
        if path.endswith('/search-report'): return report(event)
        if path.endswith('/event'): return log_event(event)
        return search(event)
    except Exception as e:
        print('ERROR', repr(e))
        return resp(500, {'ok': False, 'error': 'Internal error'})
