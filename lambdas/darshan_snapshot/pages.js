// pages.js — every Darśana work gets its own page: /darshan/art/{slug} (owner, 2026-10-11).
//
// Runs inside darshan_snapshot (after each new upload is tagged, and every 10 min):
//   1. assignSlugs — a public work with a real title and no slug gets one from its full
//      title ("Brahma on the Lotus — The Vedas Breathed in Stillness" →
//      brahma-on-the-lotus-the-vedas-breathed-in-stillness). Written to the catalog row
//      once and never changed, so shared links keep working. Names are unique already
//      (darshan_enrich renames a clash); "-2" is only a safety net.
//   2. writePages — each page is the live gallery page (/darshan) with its own <head>
//      (title, description, link preview, JSON-LD) and the work already in the HTML for
//      search engines. darshan.js sees /art/ in the address and shows the page. Only
//      pages whose HTML changed are written (manifest of hashes); a work that left the
//      gallery gets a "moved" page that sends visitors to /darshan.
//   3. sitemap-darshan.xml — gallery, facet pages and every work, with image tags.
const { createHash } = require('crypto');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const SITE = 'https://www.akara.studio';
const JUNK = [/^mj\s/i, /^(wallpaper( post)?|untitled|image|post|upload)\b/i, /^[0-9a-f]{8}-/i, /\.(jpe?g|png|webp)$/i];
const junk = (t) => { t = String(t || '').trim(); return t.length < 4 || JUNK.some((r) => r.test(t)); };

function slugify(t) {
  let s = String(t || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > 90) s = s.slice(0, 90).replace(/-[^-]*$/, '');
  return s;
}

async function assignSlugs(ddb, table, items) {
  const taken = new Set(items.map((i) => i.slug).filter(Boolean));
  let n = 0;
  for (const i of items) {
    if (i.slug || junk(i.title)) continue;
    const base = slugify(i.title); if (!base) continue;
    let s = base, k = 2;
    while (taken.has(s)) s = `${base}-${k++}`;
    try {
      await ddb.send(new UpdateCommand({ TableName: table, Key: { pk: i.pk, sk: i.sk },
        UpdateExpression: 'SET slug = :s', ConditionExpression: 'attribute_not_exists(slug)', ExpressionAttributeValues: { ':s': s } }));
      i.slug = s; taken.add(s); n++;
    } catch (e) { console.warn('slug not written', i.pk, e.name || e); }
  }
  return n;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const preview = (it) => `${SITE}/content/previews/${it.fileKey.split('/').pop().replace(/\.[^.]+$/, '')}.jpg`;
const parts = (title) => { const [t, ...r] = String(title).split(' — '); return [t, r.join(' — ')]; };

// Facet names and slugs from data.js plus the AI's deity registry.
async function facets() {
  const src = await (await fetch(`${SITE}/akara/darshan/data.js`)).text();
  const d = JSON.parse(src.match(/\/\*DATA-BEGIN\*\/([\s\S]*)\/\*DATA-END\*\//)[1]);
  try {
    const reg = await (await fetch(`${SITE}/content/darshan/deities.json`)).json();
    const have = new Set(d.deities.map((x) => x.name));
    (reg.deities || []).forEach((x) => { if (x && x.slug && !have.has(x.name)) d.deities.push(x); });
  } catch (e) { /* registry unreadable: core list only */ }
  return d;
}

function setMeta(html, attr, key, val) {
  const re = new RegExp(`(<meta ${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" content=")[^"]*(")`);
  return html.replace(re, (m, a, b) => a + esc(val) + b);
}

function pageHtml(base, it, D, prefix) {
  const [title, line] = parts(it.title);
  const url = `${SITE}/${prefix}/art/${it.slug}`;
  const og = preview(it);
  const deity = D.deities.find((x) => x.name === (it.deities || [])[0]);
  const couple = it.couple && D.couples.find((x) => x.slug === it.couple);
  const facet = couple || deity;
  const ftitle = facet ? (facet.title || facet.name) : '';
  const full = title + (line ? ` — ${line}` : '');
  const desc = (it.caption || `${full}. Devotional art by Akara.`) + ' Free full-size download with an Akara account.';
  let h = base;
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${esc(full)} · Darśana · Akara</title>`);
  h = setMeta(h, 'name', 'description', desc);
  h = h.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${esc(url)}">`);
  h = setMeta(h, 'property', 'og:type', 'article');
  h = setMeta(h, 'property', 'og:title', `${full} · Darśana by Akara`);
  h = setMeta(h, 'property', 'og:description', desc);
  h = setMeta(h, 'property', 'og:image', og);
  h = setMeta(h, 'property', 'og:image:secure_url', og);
  h = setMeta(h, 'property', 'og:image:alt', title);
  h = setMeta(h, 'property', 'og:url', url);
  h = setMeta(h, 'name', 'twitter:title', `${full} · Darśana by Akara`);
  h = setMeta(h, 'name', 'twitter:description', desc);
  h = setMeta(h, 'name', 'twitter:image', og);
  const ld = [{
    '@context': 'https://schema.org', '@type': 'VisualArtwork', name: title, alternateName: line || undefined,
    description: it.caption || undefined, image: og, url, artform: 'Devotional digital art',
    about: (it.deities || []).map((n) => ({ '@type': 'Thing', name: n })),
    creator: { '@type': 'Organization', name: 'Akara', url: SITE },
    isPartOf: { '@type': 'CollectionPage', name: 'Darśana', url: `${SITE}/${prefix}` },
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Darśana', item: `${SITE}/${prefix}` },
      ...(facet ? [{ '@type': 'ListItem', position: 2, name: ftitle, item: `${SITE}/${prefix}/${facet.slug}` }] : []),
      { '@type': 'ListItem', position: facet ? 3 : 2, name: title, item: url },
    ],
  }];
  h = h.replace('</head>', `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`);
  h = h.replace(/<body[^>]*>/, '<body class="work-mode">');
  // Only the work's own title is an <h1> on this page.
  h = h.replace(/<h1 class="word">([\s\S]*?)<\/h1>/, '<div class="word">$1</div>');
  const work = `<section class="work" id="work"><nav class="wk-crumb"><a href="/${prefix}" class="wk-home">Darśana</a>` +
    (facet ? `<i aria-hidden="true">·</i><a href="/${prefix}/${esc(facet.slug)}">${esc(ftitle)}</a>` : '') + '</nav>' +
    `<article class="wk-main"><div class="pic wk-pic"><img src="${esc(og)}" alt="${esc(title)}"></div><div class="side wk-side"><div class="k">Darśana</div>` +
    `<h1 class="wt">${esc(title)}</h1>${line ? `<div class="line">${esc(line)}</div>` : ''}${it.caption ? `<p class="cap">${esc(it.caption)}</p>` : ''}</div></article></section>`;
  if (/<section class="work" id="work"><\/section>/.test(h)) h = h.replace(/<section class="work" id="work"><\/section>/, work);
  else h = h.replace('<main>', `<main>\n    ${work}`);
  return h;
}

function movedHtml(prefix) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Darśana · Akara</title>` +
    `<meta http-equiv="refresh" content="0;url=/${prefix}"><link rel="canonical" href="${SITE}/${prefix}"></head>` +
    `<body><p>This work has moved. <a href="/${prefix}">Open the Darśana gallery</a>.</p></body></html>`;
}

function sitemap(items, D, prefix) {
  const day = (s) => (s ? String(s).slice(0, 10) : '');
  const u = (loc, mod, img) => `<url><loc>${esc(loc)}</loc>${mod ? `<lastmod>${mod}</lastmod>` : ''}${img ? `<image:image><image:loc>${esc(img[0])}</image:loc><image:title>${esc(img[1])}</image:title></image:image>` : ''}</url>`;
  const out = [u(`${SITE}/${prefix}`)];
  [...D.deities, ...D.couples, ...D.bhavas].forEach((f) => { if (f.slug) out.push(u(`${SITE}/${prefix}/${f.slug}`)); });
  items.forEach((it) => out.push(u(`${SITE}/${prefix}/art/${it.slug}`, day(it.organizedAt), [preview(it), parts(it.title)[0]])));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${out.join('\n')}\n</urlset>\n`;
}

async function writePages(s3, bucket, items, { prefix = 'darshan', sitemapKey = 'sitemap-darshan.xml' } = {}) {
  const base = await (await fetch(`${SITE}/${prefix}`, { headers: { 'Cache-Control': 'no-cache' } })).text();
  if (!/id="vw"/.test(base) || !/darshan\.js/.test(base)) throw new Error(`base page /${prefix} does not look like the gallery`);
  const D = await facets();
  const manKey = `akara/darshan/pages-${prefix}.json`;
  let man = {};
  try { man = JSON.parse(await (await s3.send(new GetObjectCommand({ Bucket: bucket, Key: manKey }))).Body.transformToString()); } catch (e) { /* first run */ }
  const live = items.filter((it) => it.slug);
  const jobs = [];
  const next = {};
  for (const it of live) {
    const html = pageHtml(base, it, D, prefix), h = createHash('sha256').update(html).digest('hex').slice(0, 20);
    next[it.slug] = h;
    if (man[it.slug] !== h) jobs.push([it.slug, html]);
  }
  for (const slug of Object.keys(man)) if (!next[slug] && man[slug] !== 'moved') { next[slug] = 'moved'; jobs.push([slug, movedHtml(prefix)]); }
  for (const slug of Object.keys(man)) if (!next[slug]) next[slug] = man[slug];
  const put = ([slug, html]) => s3.send(new PutObjectCommand({ Bucket: bucket, Key: `${prefix}/art/${slug}.html`, Body: html,
    ContentType: 'text/html; charset=utf-8', CacheControl: 'public, max-age=300, stale-while-revalidate=600' }));
  for (let i = 0; i < jobs.length; i += 16) await Promise.all(jobs.slice(i, i + 16).map(put));
  let sm = false;
  if (jobs.length || !Object.keys(man).length) {
    if (sitemapKey) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: sitemapKey, Body: sitemap(live, D, prefix), ContentType: 'application/xml', CacheControl: 'public, max-age=600' }));
      sm = true;
    }
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: manKey, Body: JSON.stringify(next), ContentType: 'application/json', CacheControl: 'no-store' }));
  }
  return { written: jobs.length, pages: live.length, sitemap: sm };
}

module.exports = { slugify, assignSlugs, writePages, pageHtml, junk };
