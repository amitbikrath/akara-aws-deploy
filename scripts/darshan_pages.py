"""Generate the static /darshan pages from one template.

Every page is the same app (akara/darshan/darshan.js); only the <head> differs
so link previews and search results name the right deity. Writes:
  frontend/public/darshan.html            → /darshan
  frontend/public/darshan/{slug}.html     → /darshan/{slug}  (CloudFront adds .html)

Usage: python darshan_pages.py [--out DIR] [--prefix darshan-test]
  --prefix lets you build a staging copy (/darshan-test/...) that never touches
  the live paths.
"""
import argparse, html, json, os, re, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'frontend', 'public')
SITE = 'https://www.akara.studio'


def data():
    src = open(os.path.join(PUB, 'akara', 'darshan', 'data.js'), encoding='utf-8').read()
    d = json.loads(re.search(r'/\*DATA-BEGIN\*/(.*)/\*DATA-END\*/', src, re.S).group(1))
    # Deities the AI added later (lambdas/darshan_enrich/deity_registry.py) get pages too.
    try:
        reg = json.load(urllib.request.urlopen(f'{SITE}/content/darshan/deities.json', timeout=15))
        have = {f['name'] for f in d['deities']}
        d['deities'] += [x for x in reg.get('deities', []) if x.get('slug') and x['name'] not in have]
    except Exception as e:
        print('deity registry not read:', e)
    return d


def catalog():
    items, key = [], ''
    while True:
        u = f'{SITE}/api/catalog?type=wallpaper&limit=100' + (f'&lastEvaluatedKey={key}' if key else '')
        d = json.load(urllib.request.urlopen(u, timeout=30))
        items += d.get('items', [])
        key = d.get('lastEvaluatedKey')
        if not key:
            return [i for i in items if not i.get('hiddenFromPublic') and i.get('fileKey')]


def shop_map(d):
    """deity/couple slug → shop products whose title names it (tees, mugs…)."""
    lib = open(os.path.join(PUB, 'akara', 'lib.jsx'), encoding='utf-8').read()
    blk = lib[lib.index('const AKARA_SHOPIFY'):][:400]
    token = re.search(r'token:\s*"([^"]+)"', blk).group(1)
    domain = re.search(r'domain:\s*"([^"]+)"', blk).group(1)
    version = re.search(r'version:\s*"([^"]+)"', blk).group(1)
    q = json.dumps({'query': '{ products(first: 100) { nodes { handle title availableForSale featuredImage { url } } } }'}).encode()
    req = urllib.request.Request(f'https://{domain}/api/{version}/graphql.json', data=q, headers={
        'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token})
    nodes = json.load(urllib.request.urlopen(req, timeout=30))['data']['products']['nodes']
    names = {f['slug']: [f['name']] for f in d['deities']}
    names.update({'radha-krishna': ['Radha Krishna'], 'sita-rama': ['Sita Ram'], 'shiva-parvati': ['Shiva Parvati'], 'lakshmi-narayana': ['Lakshmi Narayan']})
    names['krishna'].append('Radha Krishna'); names['rama'].append('Sita Ram')
    out = {}
    for slug, keys in names.items():
        hits = [n for n in nodes if n.get('availableForSale') and any(k.lower() in n['title'].lower() for k in keys)]
        if hits:
            out[slug] = [{'title': n['title'].split(' | ')[0], 'url': f"/shop/{n['handle']}",
                          'img': (n.get('featuredImage') or {}).get('url', '')} for n in hits[:4]]
    return out


def preview(it):
    uuid = re.sub(r'\.[^.]+$', '', it['fileKey'].split('/')[-1])
    return f'{SITE}/content/previews/{uuid}.jpg'


def cover(items, slug, test):
    pool = [i for i in items if test(i)]
    hero = [i for i in pool if slug in (i.get('heroFor') or [])]
    named = [i for i in pool if i.get('organizedAt')]
    pick = (hero or named or pool or [None])[0]
    return preview(pick) if pick else f'{SITE}/akara/vishwaroopa/og-series.jpg'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--prefix', default='darshan')
    args = ap.parse_args()
    d, items = data(), catalog()
    tpl = open(os.path.join(PUB, 'akara', 'darshan', 'template.html'), encoding='utf-8').read()
    v = time.strftime('%Y%m%d%H%M')
    pages = [('', {
        'TITLE': 'Darśana · Akara — devotional art by deity, mood and colour',
        'OGTITLE': 'Darśana · the Akara gallery by devatā',
        'DESC': 'Browse every Akara artwork by deity, divine couple, bhāva and colour. Free full-size wallpapers with an Akara account.',
        'OG': f'{SITE}/akara/vishwaroopa/og-series.jpg', 'OGALT': 'Akara devotional art',
        'RULE': 'Darśana · the gallery by devatā · Pune',
    })]
    for f in d['deities']:
        name = f['name']
        pages.append((f['slug'], {
            'TITLE': f"{f['title']} wallpapers · Darśana · Akara",
            'OGTITLE': f"{f['title']} · Darśana by Akara",
            'DESC': f"{f['dek']} Devotional {name} art and ślokas, free full-size downloads.",
            'OG': cover(items, f['slug'], lambda i, n=name: n in (i.get('deities') or [])),
            'OGALT': f"{name} by Akara", 'RULE': f"Darśana · Devatā · {f['title']}", 'WORDTEXT': f['title'], 'KICKTEXT': 'Darśana · Devatā',
        }))
    for f in d['couples']:
        pages.append((f['slug'], {
            'TITLE': f"{f['title']} wallpapers · Darśana · Akara",
            'OGTITLE': f"{f['title']} · Darśana by Akara",
            'DESC': f"{f['dek']} Devotional art of the divine couple, free full-size downloads.",
            'OG': cover(items, f['slug'], lambda i, s=f['slug']: i.get('couple') == s),
            'OGALT': f"{f['name']} by Akara", 'RULE': f"Darśana · Yugala · {f['title']}", 'WORDTEXT': f['title'], 'KICKTEXT': 'Darśana · Yugala',
        }))
    for f in d['bhavas']:
        pages.append((f['slug'], {
            'TITLE': f"{f['title']} · {f['en']} devotional art · Darśana · Akara",
            'OGTITLE': f"{f['title']} · {f['en']} · Darśana by Akara",
            'DESC': f"{f['dek']} Akara artworks in the {f['en'].lower()} bhāva.",
            'OG': cover(items, f['slug'], lambda i, s=f['slug']: i.get('bhava') == s),
            'OGALT': f"{f['en']} devotional art by Akara", 'RULE': f"Darśana · Bhāva · {f['title']}", 'WORDTEXT': f['title'], 'KICKTEXT': 'Darśana · Bhāva',
        }))
    for f in d['shapes']:
        pages.append((f['slug'], {
            'TITLE': f"{f['title']} · devotional wallpapers · Darśana · Akara",
            'OGTITLE': f"{f['title']} · Darśana by Akara",
            'DESC': f"Akara devotional wallpapers shaped {f['title'].lower()}.",
            'OG': f'{SITE}/akara/vishwaroopa/og-series.jpg', 'OGALT': 'Akara devotional art',
            'RULE': f"Darśana · Ākāra · {f['title']}",
        }))

    os.makedirs(os.path.join(PUB, args.prefix), exist_ok=True)
    written = []
    for slug, m in pages:
        url = f"{SITE}/{args.prefix}" + (f'/{slug}' if slug else '')
        out = tpl
        # First-paint header: kicker + the big word (the display font lacks capital Ś,
        # so it gets the same drawn accent as darshan.js bigWord()).
        word = m.get('WORDTEXT', 'Darśana')
        out = out.replace('{{WORD}}', html.escape(word).replace('Ś', '<span class="ac">S</span>'))
        out = out.replace('{{KICK}}', html.escape(m.get('KICKTEXT', 'Akara · दर्शन')))
        for k, val in dict(m, URL=url, V=v).items():
            if k in ('WORDTEXT', 'KICKTEXT'):
                continue
            out = out.replace('{{' + k + '}}', html.escape(val, quote=True))
        path = os.path.join(PUB, f'{args.prefix}.html') if not slug else os.path.join(PUB, args.prefix, f'{slug}.html')
        open(path, 'w', encoding='utf-8').write(out)
        written.append(os.path.relpath(path, PUB))
    shop = shop_map(d)
    open(os.path.join(PUB, 'akara', 'darshan', 'prints.js'), 'w', encoding='utf-8').write(
        '// Generated by scripts/darshan_pages.py — shop items per deity page.\nwindow.DARSHAN_SHOP = ' + json.dumps(shop, ensure_ascii=False) + ';\n')
    print(len(written), 'pages:', ', '.join(written[:6]), '…')
    print('shop items for:', ', '.join(f'{k} ({len(v)})' for k, v in shop.items()))


if __name__ == '__main__':
    main()
