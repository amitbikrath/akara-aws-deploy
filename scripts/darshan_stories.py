"""Add story tags (from the curated list in akara/darshan/data.js) to every
wallpaper's aiSuggestion. Up to 2 stories per image; may propose one new story
for the owner to add to the list (kept in aiSuggestion.storyNew, never live).
Usage: python darshan_stories.py [--limit N] [--force] [--workers 24]
"""
import argparse, base64, io, json, os, re, time
from concurrent.futures import ThreadPoolExecutor, as_completed
import boto3, anthropic
from boto3.dynamodb.conditions import Key
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = 'akara-assets-738983679688-us-east-1'
data = json.loads(re.search(r'/\*DATA-BEGIN\*/(.*)/\*DATA-END\*/', open(os.path.join(ROOT, 'frontend/public/akara/darshan/data.js'), encoding='utf-8').read(), re.S).group(1))
STORIES = {s['slug']: s for s in data['stories']}
LIST = '\n'.join(f"- {s['slug']}: {s['title']} — {s['en']} ({', '.join(s['deities'])})" for s in data['stories'])
SCHEMA = {'type': 'object', 'additionalProperties': False, 'required': ['stories', 'storyNew', 'confidence'], 'properties': {
    'stories': {'type': 'array', 'items': {'type': 'string', 'enum': list(STORIES)}},
    'storyNew': {'type': 'string'}, 'confidence': {'type': 'string', 'enum': ['high', 'medium', 'low']}}}
SYSTEM = f"""You tag Hindu devotional artworks with the STORY or episode they depict, using only this list:
{LIST}

Rules:
- Pick 0, 1 or 2 slugs. Pick a story only when the image clearly shows that episode (its key iconography: e.g. pillar + lion-man + child = narasimha-prahlada; chariot + Arjuna + battlefield = kurukshetra; mountain on one finger = govardhana; Hanumān flying with a mountain = sanjeevani).
- A plain portrait of a deity with no episode gets [] (do not guess). A flute in a pastoral scene = murali. Meditation on snowy peaks = kailasa-dhyana.
- storyNew: if the image clearly shows a well-known episode NOT in the list, name it in a few words; else "".
- confidence: how sure you are about the stories you picked (or that there is none)."""

def img_b64(s3, it):
    k = it['fileKey']; base = k.split('/')[-1].rsplit('.', 1)[0]
    for key in (f'previews-sm/{base}.webp', f'previews/{base}.jpg', k):
        try:
            im = Image.open(io.BytesIO(s3.get_object(Bucket=ASSETS, Key=key)['Body'].read())).convert('RGB')
            im.thumbnail((800, 800)); b = io.BytesIO(); im.save(b, 'JPEG', quality=85)
            return base64.standard_b64encode(b.getvalue()).decode()
        except Exception:
            continue
    return None

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--limit', type=int, default=0); ap.add_argument('--force', action='store_true'); ap.add_argument('--workers', type=int, default=24); ap.add_argument('--ids-file', default='')
    a = ap.parse_args()
    ddb = boto3.resource('dynamodb', region_name='us-east-1'); t = ddb.Table('akara-catalog'); s3 = boto3.client('s3', region_name='us-east-1')
    key = boto3.client('ssm', region_name='us-east-1').get_parameter(Name='/akara/anthropic/key', WithDecryption=True)['Parameter']['Value']
    client = anthropic.Anthropic(api_key=key)
    items, kw = [], dict(IndexName='TypeIndex', KeyConditionExpression=Key('type').eq('wallpaper'))
    while True:
        r = t.query(**kw); items += r['Items']
        if 'LastEvaluatedKey' not in r: break
        kw['ExclusiveStartKey'] = r['LastEvaluatedKey']
    todo = [i for i in items if i.get('aiSuggestion') and (a.force or 'stories' not in i['aiSuggestion'])]
    if a.ids_file:
        want = {x['id'] for x in json.load(open(a.ids_file))}
        todo = [i for i in todo if i['pk'].split('#')[1] in want]
    if a.limit: todo = todo[:a.limit]
    print(len(todo), 'to tag', flush=True)

    def work(it):
        s = it['aiSuggestion']; b64 = img_b64(s3, it)
        if not b64: return it, None
        ctx = f"title: {s.get('title','')}\nform: {s.get('form','')}\ndeities: {s.get('deities',[])}\ncaption: {s.get('caption','')}"
        for attempt in range(4):
            try:
                resp = client.messages.create(model='claude-opus-5-5', max_tokens=2000, system=SYSTEM,
                    output_config={'effort': 'low', 'format': {'type': 'json_schema', 'schema': SCHEMA}},
                    messages=[{'role': 'user', 'content': [{'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': b64}}, {'type': 'text', 'text': ctx}]}])
                if resp.stop_reason == 'refusal': return it, None
                return it, json.loads(next(x.text for x in resp.content if x.type == 'text'))
            except anthropic.RateLimitError: time.sleep(8 * (attempt + 1))
            except anthropic.APIStatusError as e:
                if e.status_code >= 500: time.sleep(4); continue
                raise
        return it, None

    done = fail = 0
    with ThreadPoolExecutor(a.workers) as ex:
        for f in as_completed([ex.submit(work, i) for i in todo]):
            try: it, out = f.result()
            except Exception as e: fail += 1; print('ERR', e, flush=True); continue
            if not out: fail += 1; continue
            stories = [x for x in out['stories'] if x in STORIES][:2]
            t.update_item(Key={'pk': it['pk'], 'sk': it['sk']},
                UpdateExpression='SET aiSuggestion.stories = :s, aiSuggestion.storyNew = :n, aiSuggestion.storyConfidence = :c, stories = :s',
                ExpressionAttributeValues={':s': stories, ':n': out.get('storyNew', ''), ':c': out['confidence']})
            done += 1
            if done % 50 == 0: print(done, 'done', flush=True)
    print(f'finished: {done} tagged, {fail} failed', flush=True)

if __name__ == '__main__':
    main()
