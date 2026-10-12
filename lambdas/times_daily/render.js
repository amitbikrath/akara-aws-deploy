// render.js — turn an article record into crawlable static HTML + the /times
// archive + sitemap.xml + robots.txt. The whole point: real server-rendered
// HTML with full body text, semantic markup, meta tags, and JSON-LD, so Google
// AND the AI crawlers (GPTBot, ClaudeBot, PerplexityBot…) can read and cite it.
// The current Edition is a JS overlay invisible to those crawlers; these pages
// are the discoverable surface.

const SITE_DEFAULT = 'https://www.akara.studio';
const SECTION = 'Akara Times';
const ORG = 'Akara';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function attr(s) {
  return esc(s);
}
function jsonLd(obj) {
  // Embed-safe: prevent </script> breakout.
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function slugify(title, date) {
  let base = String(title || 'article')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  // Trim to <= 60 chars on a word boundary so we never cut mid-word.
  if (base.length > 60) {
    let acc = '';
    for (const w of base.split('-')) {
      const next = acc ? `${acc}-${w}` : w;
      if (next.length > 60) break;
      acc = next;
    }
    base = acc || base.slice(0, 60);
  }
  const d = (date instanceof Date ? date : new Date(date || Date.now())).toISOString().slice(0, 10);
  return `${d}-${base || 'dispatch'}`;
}

function inlineMd(escaped) {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener nofollow">$1</a>');
}

// Minimal, safe markdown → HTML for the article body. Line-based so a heading
// immediately followed by text (no blank line) — how models often write — is
// still isolated correctly, and runs of bullets/quotes group into one element.
function mdToHtml(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = [];
  let quote = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inlineMd(esc(para.join(' ').trim()))}</p>`); para = []; } };
  const flushList = () => { if (list.length) { out.push(`<ul>${list.map((li) => `<li>${inlineMd(esc(li))}</li>`).join('')}</ul>`); list = []; } };
  const flushQuote = () => { if (quote.length) { out.push(`<blockquote>${inlineMd(esc(quote.join(' ').trim()))}</blockquote>`); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushAll(); continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushAll();
      const tag = m[1].length >= 3 ? 'h3' : 'h2';
      out.push(`<${tag}>${inlineMd(esc(m[2]))}</${tag}>`);
    } else if (/^(-|\*|•)\s+/.test(line)) {
      flushPara(); flushQuote();
      list.push(line.replace(/^(-|\*|•)\s+/, ''));
    } else if (/^>\s?/.test(line)) {
      flushPara(); flushList();
      quote.push(line.replace(/^>\s?/, ''));
    } else {
      flushList(); flushQuote();
      para.push(line);
    }
  }
  flushAll();
  return out.join('\n');
}

const BASE_CSS = `
:root{--paper:#f4ede1;--ink:#1a1510;--muted:#6b6052;--gold:#9c6f2b;--rule:rgba(26,21,16,.18);--maxw:1320px}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#0b0b0a;color:var(--ink);font-family:'Iowan Old Style',Georgia,'Times New Roman',serif;line-height:1.66}
.wrap{max-width:var(--maxw);width:94%;margin:0 auto;background:var(--paper);min-height:100vh;padding:0 clamp(24px,4vw,64px) 110px;box-shadow:0 0 150px rgba(0,0,0,.55)}
.masthead{text-align:center;padding:40px 0 16px;border-bottom:3px double var(--ink)}
.masthead a{color:inherit;text-decoration:none}
.masthead .title{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:clamp(48px,8vw,104px);line-height:.9;margin:0}
.masthead .sub{font:12px/1.4 ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.34em;text-transform:uppercase;color:var(--muted);margin-top:10px}
.crumbs{font:11px/1.6 ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);padding:18px 0 0}
.crumbs a{color:var(--gold);text-decoration:none}
.kicker{font:11px/1.6 ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.3em;text-transform:uppercase;color:var(--gold);margin:24px 0 8px}
h1.headline{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(40px,6.4vw,86px);line-height:1.0;letter-spacing:-.015em;margin:0 0 18px;text-wrap:balance;max-width:20ch}
.dek{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:clamp(19px,2.5vw,30px);line-height:1.38;color:#3a3228;margin:0 0 22px;text-wrap:balance;max-width:62ch}
.byline{font:11px/1.6 ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:14px 0;margin:0 0 32px;display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between}
figure{margin:0 0 36px}
figure img{width:100%;height:auto;max-height:78vh;object-fit:cover;display:block;border:1px solid var(--rule)}
figcaption{font:11px/1.5 ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.1em;color:var(--muted);padding-top:10px;text-transform:uppercase}
.article{font-size:18.5px;column-count:2;column-gap:54px;column-rule:1px solid var(--rule)}
.article p{margin:0 0 18px}
.article h2{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(28px,3vw,38px);line-height:1.1;margin:32px 0 14px;column-span:all;break-inside:avoid;border-top:1px solid var(--rule);padding-top:20px}
.article h3{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:23px;margin:24px 0 10px;break-inside:avoid}
.article blockquote{margin:30px 0;padding:14px 0 14px 26px;border-left:3px solid var(--gold);font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:clamp(24px,2.8vw,32px);line-height:1.3;color:#2a241c;column-span:all;break-inside:avoid}
.article ul{margin:0 0 18px;padding-left:22px}
.article li{margin:0 0 8px}
.article a{color:var(--gold)}
.lede{column-span:all;font-size:20px;margin:0 0 22px}
.lede::first-letter{font-family:'Instrument Serif',Georgia,serif;font-style:italic;float:left;font-size:92px;line-height:.62;padding:8px 12px 0 0;color:var(--gold)}
.shloka{margin:32px auto;padding:26px 30px;background:rgba(156,111,43,.07);border:1px solid rgba(156,111,43,.25);column-span:all;break-inside:avoid;text-align:center;max-width:760px}
.shloka .sa{font-family:'Instrument Serif',Georgia,serif;font-size:24px;line-height:1.5;margin:0 0 8px}
.shloka .me{font-style:italic;color:#3a3228;margin:0}
.faq{margin:48px 0 0;border-top:3px double var(--ink);padding-top:10px}
.faq h2{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:30px;margin:20px 0 14px}
.faq details{border-bottom:1px solid var(--rule);padding:14px 0}
.faq summary{cursor:pointer;font-weight:600;font-size:19px}
.faq details p{margin:10px 0 0;color:#3a3228;max-width:80ch}
.refs{margin:40px 0 0;font-size:14px;color:var(--muted)}
.refs a{color:var(--gold)}
.endmark{text-align:center;color:var(--gold);letter-spacing:.5em;margin:46px 0}
.foot{margin-top:50px;border-top:1px solid var(--rule);padding-top:22px;font:11px/1.7 ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.foot a{color:var(--gold);text-decoration:none}
.cta{display:inline-block;margin:8px 12px 0 0;padding:13px 24px;background:var(--ink);color:var(--paper);text-decoration:none;font:11px/1 ui-monospace,Menlo,monospace;letter-spacing:.2em;text-transform:uppercase}
.archive-item{padding:26px 0;border-bottom:1px solid var(--rule);display:grid;grid-template-columns:170px 1fr;gap:28px;align-items:start}
.archive-item img{width:170px;height:212px;object-fit:cover;border:1px solid var(--rule)}
.archive-item h2{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:30px;line-height:1.05;margin:6px 0 8px}
.archive-item a{color:inherit;text-decoration:none}
.archive-item .dek{font-size:17px;margin:0;max-width:none}
@media(max-width:980px){.wrap{width:100%;max-width:none}.article{column-count:1;column-gap:0;column-rule:none}h1.headline,.dek{max-width:none}}
@media(max-width:560px){.wrap{padding:0 18px 80px}.archive-item{grid-template-columns:1fr}.archive-item img{width:100%;height:auto;max-height:260px}}
`;

const FONTS_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">';

// Google Analytics 4 + the shared Akara tracker (clicks, scroll, time).
// Same tag as the main site (public/akara/lib.jsx) and /ganpati.html.
const GA_ID = 'G-BQEB260FD7';
const GA_SNIPPET = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_ID}');
</script>
<script async src="/akara/ak-track.js"></script>`;

function head({ title, description, canonical, image, keywords, type = 'website', extraJsonLd = [], published, modified, section, tags }) {
  const parts = [];
  parts.push('<meta charset="utf-8">');
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  parts.push(`<title>${esc(title)}</title>`);
  parts.push(`<meta name="description" content="${attr(description)}">`);
  if (keywords && keywords.length) parts.push(`<meta name="keywords" content="${attr(keywords.join(', '))}">`);
  parts.push('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">');
  parts.push(`<link rel="canonical" href="${attr(canonical)}">`);
  // OpenGraph
  parts.push(`<meta property="og:type" content="${attr(type)}">`);
  parts.push(`<meta property="og:site_name" content="${attr(ORG + ' · ' + SECTION)}">`);
  parts.push(`<meta property="og:title" content="${attr(title)}">`);
  parts.push(`<meta property="og:description" content="${attr(description)}">`);
  parts.push(`<meta property="og:url" content="${attr(canonical)}">`);
  parts.push('<meta property="og:locale" content="en_IN">');
  if (image) {
    parts.push(`<meta property="og:image" content="${attr(image.url)}">`);
    if (image.width) parts.push(`<meta property="og:image:width" content="${attr(image.width)}">`);
    if (image.height) parts.push(`<meta property="og:image:height" content="${attr(image.height)}">`);
    if (image.alt) parts.push(`<meta property="og:image:alt" content="${attr(image.alt)}">`);
  }
  if (type === 'article') {
    if (published) parts.push(`<meta property="article:published_time" content="${attr(published)}">`);
    if (modified) parts.push(`<meta property="article:modified_time" content="${attr(modified)}">`);
    if (section) parts.push(`<meta property="article:section" content="${attr(section)}">`);
    for (const t of tags || []) parts.push(`<meta property="article:tag" content="${attr(t)}">`);
  }
  // Twitter
  parts.push('<meta name="twitter:card" content="summary_large_image">');
  parts.push('<meta name="twitter:site" content="@akara__1">');
  parts.push(`<meta name="twitter:title" content="${attr(title)}">`);
  parts.push(`<meta name="twitter:description" content="${attr(description)}">`);
  if (image) parts.push(`<meta name="twitter:image" content="${attr(image.url)}">`);
  parts.push(FONTS_LINK);
  for (const ld of extraJsonLd) parts.push(`<script type="application/ld+json">${jsonLd(ld)}</script>`);
  parts.push(`<style>${BASE_CSS}</style>`);
  parts.push(GA_SNIPPET);
  return parts.join('\n');
}

function publisherLd(site) {
  return {
    '@type': 'Organization',
    name: ORG,
    url: site,
    logo: { '@type': 'ImageObject', url: `${site}/akara/assets/akara-logo.png` },
    sameAs: ['https://x.com/akara__1', 'https://instagram.com/akaraxstudio', 'https://pinterest.com/akaraxstudio'],
  };
}

function articleHtml(a, ctx = {}) {
  const site = ctx.site || SITE_DEFAULT;
  const url = `${site}/times/${a.slug}`;
  const metaTitle = (a.metaTitle || a.title || '').slice(0, 65);
  // Avoid doubling the section if the model already worked it into metaTitle.
  const fullTitle = /akara\s*times/i.test(metaTitle) ? metaTitle : `${metaTitle} · ${SECTION}`;
  const desc = (a.metaDescription || a.dek || '').slice(0, 200);
  const img = a.image || ctx.defaultImage || null;
  const tags = a.keywords || [];

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: (a.title || '').slice(0, 110),
    description: desc,
    image: img ? [img.url] : undefined,
    datePublished: a.datePublished,
    dateModified: a.dateModified || a.datePublished,
    author: { '@type': 'Organization', name: ORG, url: site },
    publisher: publisherLd(site),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    articleSection: a.category || SECTION,
    keywords: (a.keywords || []).join(', '),
    inLanguage: 'en',
    isAccessibleForFree: true,
  };
  if (a.deityDisplay && a.deitySameAs) {
    articleLd.about = { '@type': 'Thing', name: a.deityDisplay, sameAs: a.deitySameAs };
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: site },
      { '@type': 'ListItem', position: 2, name: SECTION, item: `${site}/times` },
      { '@type': 'ListItem', position: 3, name: a.title, item: url },
    ],
  };

  const extraJsonLd = [articleLd, breadcrumbLd];
  if (a.faq && a.faq.length) {
    extraJsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: a.faq.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  const dateHuman = new Date(a.datePublished).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata',
  });
  const pan = a.panchang
    ? `${a.panchang.paksha} ${a.panchang.tithi} · ${a.panchang.nakshatra} · Pune`
    : 'Pune';

  const figure = img
    ? `<figure>
        <a href="${attr(site)}/#wallpapers"><img src="${attr(img.url)}" width="${attr(img.width || 1200)}" height="${attr(img.height || 1500)}" alt="${attr(img.alt)}" loading="eager"></a>
        <figcaption>${esc(img.title || img.alt)} — from the Akara collection</figcaption>
      </figure>`
    : '';

  const shloka = img && img.shloka
    ? `<div class="shloka"><p class="sa">${esc(img.shloka)}</p>${img.meaning ? `<p class="me">${esc(img.meaning)}</p>` : ''}</div>`
    : '';

  const faqHtml = a.faq && a.faq.length
    ? `<section class="faq"><h2>Questions &amp; answers</h2>${a.faq
        .map((f) => `<details><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`)
        .join('')}</section>`
    : '';

  const refsHtml = a.references && a.references.length
    ? `<aside class="refs"><strong>Sources &amp; further reading</strong><ul>${a.references
        .map((r) => `<li><a href="${attr(r.url)}" rel="noopener nofollow">${esc(r.title || r.url)}</a></li>`)
        .join('')}</ul></aside>`
    : '';

  const pull = a.pullQuote ? `<blockquote>${esc(a.pullQuote)}</blockquote>` : '';
  const ledeHtml = a.lede ? `<p class="lede">${esc(a.lede)}</p>` : '';

  return `<!doctype html>
<html lang="en">
<head>
${head({ title: fullTitle, description: desc, canonical: url, image: img, keywords: a.keywords, type: 'article', extraJsonLd, published: a.datePublished, modified: a.dateModified || a.datePublished, section: a.category, tags })}
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <a href="${attr(site)}/"><div class="title">Akara Times</div></a>
    <div class="sub">सत्यम् शिवम् सुन्दरम् · The Studio Edition</div>
  </header>
  <nav class="crumbs"><a href="${attr(site)}/">Home</a> → <a href="${attr(site)}/times">${esc(SECTION)}</a> → <span>${esc(a.category || 'Dispatch')}</span></nav>
  <article>
    <div class="kicker">${esc(a.category || 'Dispatch')}${a.festivalName ? ' · ' + esc(a.festivalName) : ''}</div>
    <h1 class="headline">${esc(a.title)}</h1>
    ${a.dek ? `<p class="dek">${esc(a.dek)}</p>` : ''}
    <div class="byline"><span>By the Akara Studio Desk</span><time datetime="${attr(a.datePublished)}">${esc(dateHuman)}</time><span>${esc(pan)}</span></div>
    ${figure}
    <div class="article">
      ${ledeHtml}
      ${mdToHtml(a.body)}
      ${pull}
      ${shloka}
    </div>
    ${faqHtml}
    ${refsHtml}
    <div class="endmark">॥ ॐ ॥</div>
  </article>
  <footer class="foot">
    <div>Filed from the studio in Pune for ${esc(SECTION)}. ${esc(ORG)} crafts devotional wallpapers, music, and writing rooted in Sanatana Dharma.</div>
    <p><a class="cta" href="${attr(site)}/#wallpapers">Explore the collection →</a> &nbsp; <a class="cta" href="${attr(site)}/times">More from Akara Times →</a></p>
  </footer>
</div>
</body>
</html>`;
}

function indexHtml(articles, ctx = {}) {
  const site = ctx.site || SITE_DEFAULT;
  const url = `${site}/times`;
  const desc =
    'Akara Times — daily writing on the deities, festivals, astrology, and philosophy of Sanatana Dharma, illustrated from the Akara devotional art collection.';
  const list = (articles || [])
    .map((a) => {
      const u = `${site}/times/${a.slug}`;
      const im = a.image;
      return `<article class="archive-item">
        ${im ? `<a href="${attr(u)}"><img src="${attr(im.url)}" alt="${attr(im.alt)}" loading="lazy"></a>` : '<div></div>'}
        <div>
          <div class="kicker">${esc(a.category || 'Dispatch')}${a.festivalName ? ' · ' + esc(a.festivalName) : ''}</div>
          <h2><a href="${attr(u)}">${esc(a.title)}</a></h2>
          ${a.dek ? `<p class="dek">${esc(a.dek)}</p>` : ''}
          <div class="byline"><time datetime="${attr(a.datePublished)}">${esc(new Date(a.datePublished).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' }))}</time></div>
        </div>
      </article>`;
    })
    .join('\n');

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: SECTION,
    description: desc,
    url,
    publisher: publisherLd(site),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: (articles || []).slice(0, 30).map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${site}/times/${a.slug}`,
        name: a.title,
      })),
    },
  };

  return `<!doctype html>
<html lang="en">
<head>
${head({ title: `${SECTION} · ${ORG}`, description: desc, canonical: url, keywords: ['akara times', 'hindu spirituality', 'sanatana dharma', 'daily panchang', 'festivals', 'deities', 'vedic astrology'], extraJsonLd: [itemListLd] })}
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <a href="${attr(site)}/"><div class="title">Akara Times</div></a>
    <div class="sub">सत्यम् शिवम् सुन्दरम् · Dispatches on Sanatana Dharma</div>
  </header>
  <nav class="crumbs"><a href="${attr(site)}/">Home</a> → <span>${esc(SECTION)}</span></nav>
  <p class="dek" style="margin-top:22px">Daily writing on the deities, festivals, astrology, and living philosophy of Sanatana Dharma — illustrated from the Akara collection.</p>
  ${list || '<p>The first dispatch is being composed.</p>'}
  <footer class="foot"><a class="cta" href="${attr(site)}/#wallpapers">Explore the collection →</a></footer>
</div>
</body>
</html>`;
}

function sitemapXml(entries) {
  const urls = (entries || [])
    .map(
      (e) =>
        `  <url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${esc(e.lastmod)}</lastmod>` : ''}<changefreq>${esc(e.changefreq || 'weekly')}</changefreq><priority>${esc(e.priority != null ? e.priority : '0.7')}</priority></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function robotsTxt(site = SITE_DEFAULT) {
  const aiBots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended', 'Amazonbot', 'CCBot', 'cohere-ai', 'Bytespider', 'Meta-ExternalAgent', 'YouBot'];
  const blocks = [
    'User-agent: *',
    'Allow: /',
    '',
    ...aiBots.flatMap((b) => [`User-agent: ${b}`, 'Allow: /', '']),
    `Sitemap: ${site}/sitemap.xml`,
    `Sitemap: ${site}/sitemap-darshan.xml`, // every Darśana work page (written by akara-darshan-snapshot)
    '',
  ];
  return blocks.join('\n');
}

module.exports = { slugify, mdToHtml, articleHtml, indexHtml, sitemapXml, robotsTxt, esc };
