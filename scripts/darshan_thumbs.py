"""Make 480px WebP card thumbnails for Darśana from the watermarked previews.

previews/{uuid}.jpg (1200px, ~150 KB)  →  previews-sm/{uuid}.webp (480px, ~25 KB)
Legacy items stored under content/ get previews-sm/{basename}.webp from the file itself.
Served at /content/previews-sm/... ; the page falls back to the 1200px preview if a
thumbnail is missing (new uploads until this script runs again). Skips existing files.

Also the clean copy for signed-in members, same size and settings, no watermark:
originals/{name}.png  →  originals/sm/{name}  (cover + slideKeys)
Served at /content/originals/sm/{name} behind the originals' signed cookies. The key has
no extension on purpose: akara-generate-preview skips it instead of making a junk preview.
akara-darshan-enrich makes both for new uploads; this script is the backfill.
"""
import io, json, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
import boto3
from PIL import Image

B = 'akara-assets-738983679688-us-east-1'
s3 = boto3.client('s3', region_name='us-east-1')
items = json.load(urllib.request.urlopen('https://www.akara.studio/akara/darshan/catalog.json'))['items']
have = set()
for prefix in ('previews-sm/', 'originals/sm/'):
    for page in s3.get_paginator('list_objects_v2').paginate(Bucket=B, Prefix=prefix):
        have |= {o['Key'] for o in page.get('Contents', [])}

def small(src, out, cache):
    im = Image.open(io.BytesIO(s3.get_object(Bucket=B, Key=src)['Body'].read())).convert('RGB')
    im.thumbnail((480, 480 * 3))
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=78, method=5)
    s3.put_object(Bucket=B, Key=out, Body=buf.getvalue(), ContentType='image/webp', CacheControl=cache)
    return len(buf.getvalue())

def job(it):
    k = it['fileKey'].lstrip('/')
    base = k.split('/')[-1].rsplit('.', 1)[0]
    out = f'previews-sm/{base}.webp'
    if out in have:
        return 'skip'
    src = f'previews/{base}.jpg' if k.startswith('originals/') else k
    try:
        return small(src, out, 'public, max-age=31536000, immutable')
    except Exception as e:
        return f'miss {src}'

def clean_job(k):
    out = 'originals/sm/' + k.split('/')[-1].rsplit('.', 1)[0]
    if out in have:
        return 'skip'
    try:
        return small(k, out, 'max-age=31536000, immutable')
    except Exception as e:
        return f'miss {k}'

VIDEO = re.compile(r'\.(mp4|mov|m4v|webm)$', re.I)
clean_keys = sorted({k.lstrip('/') for it in items for k in [it['fileKey']] + (it.get('slideKeys') or [])
                     if k and k.lstrip('/').startswith('originals/') and not VIDEO.search(k)})
with ThreadPoolExecutor(16) as ex:
    res = list(ex.map(job, items)) + list(ex.map(clean_job, clean_keys))
sizes = [r for r in res if isinstance(r, int)]
print(f'made {len(sizes)}, skipped {res.count("skip")}, missing {sum(1 for r in res if isinstance(r, str) and r.startswith("miss"))}, avg {sum(sizes)//max(1,len(sizes))//1024} KB')
