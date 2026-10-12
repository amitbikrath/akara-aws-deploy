"""Build the Darśana search index with Amazon Nova 2 multimodal embeddings.

For every catalog artwork: one IMAGE vector (the 480px card picture) and one TEXT
vector (title, form, caption, deities, couple, bhava, stories + their other names).
Saved as s3://akara-assets.../darshan/search-index.json (float16, base64) for the
akara-darshan-search Lambda. Re-embeds only items whose text changed (hash) or
that are new; pass --force to redo all. Usage: python darshan_embed.py [--force]
"""
import argparse, base64, hashlib, io, json, os, re, urllib.request
from concurrent.futures import ThreadPoolExecutor
import boto3, numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = 'akara-assets-738983679688-us-east-1'
MODEL = 'amazon.nova-2-multimodal-embeddings-v1:0'
s3 = boto3.client('s3', region_name='us-east-1')
br = boto3.client('bedrock-runtime', region_name='us-east-1')
DATA = json.loads(re.search(r'/\*DATA-BEGIN\*/(.*)/\*DATA-END\*/', open(os.path.join(ROOT, 'frontend/public/akara/darshan/data.js'), encoding='utf-8').read(), re.S).group(1))
STORY = {s['slug']: s for s in DATA['stories']}
DEITY = {d['name']: d for d in DATA['deities']}

def doc(it):
    parts = [it.get('title', ''), it.get('form', ''), it.get('caption', '')]
    for n in it.get('deities') or []:
        d = DEITY.get(n); parts.append(n + (f" {d['title']} {d['sa']}" if d else ''))
    if it.get('couple'): parts.append(it['couple'].replace('-', ' '))
    if it.get('bhava'): parts.append(it['bhava'])
    for s in it.get('stories') or []:
        st = STORY.get(s)
        if st: parts.append(f"{st['title']} {st['en']} {' '.join(st['aka'])}")
    return '. '.join(p for p in parts if p)

def embed(body):
    r = br.invoke_model(modelId=MODEL, body=json.dumps({'taskType': 'SINGLE_EMBEDDING', 'singleEmbeddingParams': dict(embeddingPurpose='GENERIC_INDEX', embeddingDimension=1024, **body)}))
    v = np.array(json.loads(r['body'].read())['embeddings'][0]['embedding'], dtype=np.float32)
    return v / (np.linalg.norm(v) + 1e-9)

def img_jpeg(it):
    base = it['fileKey'].split('/')[-1].rsplit('.', 1)[0]
    raw = s3.get_object(Bucket=ASSETS, Key=f'previews-sm/{base}.webp')['Body'].read()
    b = io.BytesIO(); Image.open(io.BytesIO(raw)).convert('RGB').save(b, 'JPEG', quality=88)
    return base64.b64encode(b.getvalue()).decode()

def pack(v): return base64.b64encode(v.astype(np.float16).tobytes()).decode()
def unpack(s): return np.frombuffer(base64.b64decode(s), dtype=np.float16).astype(np.float32)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--force', action='store_true'); a = ap.parse_args()
    items = json.load(urllib.request.urlopen('https://www.akara.studio/akara/darshan/catalog.json?b=' + os.urandom(3).hex()))['items']
    try: old = {r['id']: r for r in json.loads(s3.get_object(Bucket=ASSETS, Key='darshan/search-index.json')['Body'].read())['items']}
    except Exception: old = {}
    def work(it):
        text = doc(it); h = hashlib.sha1(text.encode()).hexdigest()[:12]; o = old.get(it['id'])
        if o and not a.force and o.get('h') == h: return o
        t = pack(embed({'text': {'truncationMode': 'END', 'value': text}}))
        im = o['img'] if (o and not a.force and o.get('img')) else pack(embed({'image': {'format': 'jpeg', 'source': {'bytes': img_jpeg(it)}}}))
        return {'id': it['id'], 'h': h, 'txt': t, 'img': im}
    with ThreadPoolExecutor(8) as ex: rows = list(ex.map(work, items))
    body = json.dumps({'model': MODEL, 'dim': 1024, 'items': rows})
    s3.put_object(Bucket=ASSETS, Key='darshan/search-index.json', Body=body, ContentType='application/json')
    print(f'{len(rows)} items indexed, {len(body)//1024} KB, {sum(1 for r in rows if r.get("id") not in old or old[r["id"]].get("h") != r["h"])} (re)embedded')

if __name__ == '__main__':
    main()
