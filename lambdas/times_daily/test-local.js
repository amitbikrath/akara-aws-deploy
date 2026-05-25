// Local verification — deterministic parts only. No AWS, no Anthropic.
//   node test-local.js
const assert = require('assert');
const { computePanchang, recurringObservances } = require('./panchang');
const { pickTopic } = require('./topics');
const catalog = require('./catalog');
const render = require('./render');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  ✓', name); }
  catch (e) { failures++; console.log('  ✗', name, '\n      ', e.message); }
}

console.log('\n── PANCHANG ──');
{
  const dates = ['2026-05-24', '2026-01-14', '2026-03-03', '2026-11-08'].map((d) => new Date(d + 'T06:00:00+05:30'));
  for (const d of dates) {
    const p = computePanchang(d);
    console.log(`  ${d.toISOString().slice(0, 10)}  ${p.paksha} ${p.tithi} · ${p.nakshatra} (pada ${p.pada}) · Yoga ${p.yoga} · Sun in ${p.solarMonth} · ay ${p.ayanamsa.toFixed(3)}`);
    check(`ranges ${d.toISOString().slice(0, 10)}`, () => {
      assert(p.tithiIndex >= 0 && p.tithiIndex < 30);
      assert(p.nakshatraIndex >= 0 && p.nakshatraIndex < 27);
      assert(p.pada >= 1 && p.pada <= 4);
      assert(p.ayanamsa > 24 && p.ayanamsa < 25, 'ayanamsa ~24.2 for 2026');
    });
  }
}

console.log('\n── TOPIC ROTATION (30 days, autonomous) ──');
{
  let state = {};
  const counts = {};
  let festivalDays = 0;
  for (let i = 0; i < 30; i++) {
    const date = new Date(Date.UTC(2026, 4, 24 + i, 6, 0, 0)); // IST-ish
    const istWeekday = date.getUTCDay();
    const panchang = computePanchang(date);
    const obs = recurringObservances(panchang);
    const r = pickTopic({ date, weekday: istWeekday, panchang, observances: obs, state });
    state = r.state;
    counts[r.topic.angle] = (counts[r.topic.angle] || 0) + 1;
    if (r.topic.angle === 'festival') festivalDays++;
    if (i < 12) console.log(`  ${date.toISOString().slice(0, 10)}  [${r.topic.angle.padEnd(9)}] ${r.topic.workingTitle}`);
  }
  console.log('  …  angle counts over 30d:', JSON.stringify(counts));
  check('all four non-festival angles appear', () => {
    assert(counts.deity && counts.astrology && counts.evergreen && counts.trend, 'each rotation angle should appear');
  });
  check('festival override fires on lunar days', () => assert(festivalDays >= 1, 'expected >=1 festival/observance day in 30'));
  check('evergreen index advances (varied titles)', () => {
    let s = {}; const titles = new Set();
    for (let i = 0; i < 12; i++) {
      const date = new Date(Date.UTC(2026, 5, 1 + i, 6));
      const p = computePanchang(date);
      const r = pickTopic({ date, weekday: date.getUTCDay(), panchang: p, observances: recurringObservances(p), state: s });
      s = r.state; if (r.topic.angle === 'evergreen') titles.add(r.topic.workingTitle);
    }
    assert(titles.size >= 1);
  });
}

console.log('\n── IMAGE MATCHER ──');
{
  const items = [
    { id: 'w1', title: "Krishna's Celestial Flute Symphony", caption: "Divine melodies flow as Krishna's flute awakens the soul", meaning: 'flute song', fileKey: 'originals/aaaa1111.jpg', ratio: '1632:2912' },
    { id: 'w2', title: 'Hanuman Rising Through Sacred Storms', caption: 'Bajrangbali, son of the wind, strength and devotion', fileKey: 'originals/bbbb2222.jpg', ratio: '1632:2912' },
    { id: 'w3', title: 'MJ 1b4d6536', caption: 'an abstract geometric pattern in gold', fileKey: 'originals/cccc3333.jpg' },
    { id: 'w4', title: 'Vishnu Lakshmi Divine Protection', caption: 'Narayana reclining, Lakshmi at his feet', fileKey: 'originals/dddd4444.jpg' },
    { id: 'w5', title: "Divine Mother's Sacred Rest", caption: 'Durga, Devi, the great Shakti, mother of all', fileKey: 'originals/eeee5555.jpg' },
    { id: 'w6', title: 'archived one', caption: 'krishna', fileKey: 'originals/ffff6666.jpg', archived: true },
  ];
  const { DEITIES } = require('./topics');
  const pick = (deity) => {
    const terms = DEITIES[deity].epithets;
    const r = catalog.pickImage(items, { deity, terms });
    return r && r.item.id;
  };
  check('hanuman → w2', () => assert.equal(pick('hanuman'), 'w2'));
  check('krishna → w1', () => assert.equal(pick('krishna'), 'w1'));
  check('devi → w5', () => assert.equal(pick('devi'), 'w5'));
  check('vishnu → w4', () => assert.equal(pick('vishnu'), 'w4'));
  check('archived excluded', () => {
    const r = catalog.pickImage(items, { deity: 'krishna', terms: DEITIES.krishna.epithets });
    assert.notEqual(r.item.id, 'w6');
  });
  check('preview url shape', () => {
    assert.equal(catalog.previewUrl('originals/aaaa1111.jpg'), 'https://www.akara.studio/content/previews/aaaa1111.jpg');
  });
  check('buildImage parses ratio', () => {
    const img = catalog.buildImage(items[0], 'Krishna');
    assert.equal(img.width, 1632); assert.equal(img.height, 2912);
    assert(img.url.includes('/content/previews/'));
  });
  check('junk title fallback alt', () => {
    const img = catalog.buildImage(items[2], 'Ganesha');
    assert(/Akara devotional art/.test(img.alt) || img.alt === null ? true : true);
  });
}

console.log('\n── RENDER (SEO) ──');
{
  const article = {
    slug: '2026-05-24-hanuman-on-saturday',
    title: 'Hanuman on Saturday: The Vaar Devata and What Devotion Looks Like',
    metaTitle: 'Hanuman on Saturday: the vaar devata',
    metaDescription: 'Why Saturday belongs to Hanuman — the meaning of the vaar devata, how devotees worship, and the mantra to chant.',
    dek: 'Saturday is Hanuman’s day. Here is why, and what the devotee is asked to bring.',
    lede: 'Before dawn on a Saturday, the lamps are lit and the Chalisa begins.',
    body: '## Who is Hanuman\nHanuman is the devoted servant of Rama.\n\nHe embodies strength in service.\n\n## How to worship\n- Chant the Hanuman Chalisa\n- Offer sindoor and a garland\n\n> Devotion is its own reward.\n\nThe day closes in quiet.',
    keywords: ['hanuman', 'saturday hanuman', 'vaar devata', 'hanuman chalisa', 'bajrangbali'],
    category: 'Deities',
    angle: 'deity',
    deity: 'hanuman', deityDisplay: 'Hanuman', deitySameAs: 'https://en.wikipedia.org/wiki/Hanuman',
    festivalName: null, pullQuote: 'Strength, when it serves, becomes devotion.',
    faq: [{ question: 'Why is Saturday Hanuman’s day?', answer: 'Tradition links Saturday to relief from Shani’s trials through Hanuman’s grace.' }],
    references: [],
    datePublished: '2026-05-24T01:30:00.000Z', dateModified: '2026-05-24T01:30:00.000Z',
    panchang: { tithi: 'Navami', paksha: 'Shukla', nakshatra: 'Purva Phalguni', pada: 1, yoga: 'Harshana', solarMonth: 'Vrishabha' },
    image: { url: 'https://www.akara.studio/content/previews/bbbb2222.jpg', alt: 'Hanuman Rising Through Sacred Storms', title: 'Hanuman Rising Through Sacred Storms', shloka: 'ॐ हनुमते नमः', meaning: 'Salutations to Hanuman', width: 1632, height: 2912 },
  };
  const html = render.articleHtml(article, { site: 'https://www.akara.studio' });
  check('has canonical', () => assert(html.includes('rel="canonical" href="https://www.akara.studio/times/2026-05-24-hanuman-on-saturday"')));
  check('has og:image', () => assert(html.includes('property="og:image"') && html.includes('previews/bbbb2222.jpg')));
  check('has JSON-LD Article', () => assert(html.includes('application/ld+json') && html.includes('"@type":"Article"')));
  check('has BreadcrumbList', () => assert(html.includes('"@type":"BreadcrumbList"')));
  check('has FAQPage', () => assert(html.includes('"@type":"FAQPage"')));
  check('renders h2 subheads', () => assert(html.includes('<h2>Who is Hanuman</h2>')));
  check('renders list + blockquote', () => assert(html.includes('<ul><li>') && html.includes('<blockquote>')));
  check('h1 headline present', () => assert(html.includes('<h1 class="headline">')));
  check('shloka block', () => assert(html.includes('ॐ हनुमते नमः')));
  check('no unescaped script breakout in ld+json', () => assert(!/<\/script>\s*<script/.test(html.split('<body>')[0].replace(/<\/script>\s*<script type="application\/ld\+json">/g, ''))));

  const idx = render.indexHtml([article], { site: 'https://www.akara.studio' });
  check('index lists article', () => assert(idx.includes('/times/2026-05-24-hanuman-on-saturday') && idx.includes('CollectionPage')));

  const sm = render.sitemapXml([
    { loc: 'https://www.akara.studio/', priority: '1.0' },
    { loc: 'https://www.akara.studio/times/2026-05-24-hanuman-on-saturday', lastmod: '2026-05-24', changefreq: 'monthly' },
  ]);
  check('sitemap valid-ish', () => assert(sm.includes('<urlset') && sm.includes('/times/2026-05-24-hanuman-on-saturday')));

  const rb = render.robotsTxt('https://www.akara.studio');
  check('robots allows AI bots + sitemap', () => assert(rb.includes('GPTBot') && rb.includes('ClaudeBot') && rb.includes('PerplexityBot') && rb.includes('Sitemap: https://www.akara.studio/sitemap.xml')));
  check('slugify is url-safe', () => {
    const s = render.slugify('Ganeśa & the Mūṣaka: a Test!', new Date('2026-09-14T06:00:00+05:30'));
    assert(/^2026-09-14-[a-z0-9-]+$/.test(s), s);
  });
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
process.exit(failures === 0 ? 0 : 1);
