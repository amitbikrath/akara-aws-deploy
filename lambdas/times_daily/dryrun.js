// Pre-deploy dry run: generates TODAY's real article via Claude (reads the SSM
// SecureString key + scans the catalog) but writes NOTHING to S3/SSM/CloudFront.
// Saves the rendered page to /tmp so you can open it.
//   node dryrun.js            → today
//   node dryrun.js 2026-09-04 → a specific date (test a festival/web-search day)
const fs = require('fs');
const { run } = require('./index');
const render = require('./render');

const dateArg = process.argv[2];
const opts = { dryRun: true };
if (dateArg) opts.date = new Date(dateArg + 'T06:00:00+05:30').toISOString();

run(opts)
  .then((r) => {
    const a = r.article;
    if (!a) { console.log('No article produced:', JSON.stringify(r)); process.exit(1); }
    const line = (k, v) => console.log(k.padEnd(13), v);
    console.log('\n══════════ AKARA TIMES — DRY RUN (no writes) ══════════');
    line('ANGLE', r.topic);
    line('SLUG', a.slug);
    line('TITLE', a.title);
    line('DEK', a.dek);
    line('META DESC', a.metaDescription);
    line('CATEGORY', `${a.category}  ·  deity=${a.deity || '—'}`);
    line('KEYWORDS', a.keywords.join(', '));
    line('PANCHANG', a.panchang ? `${a.panchang.paksha} ${a.panchang.tithi} · ${a.panchang.nakshatra} · ${a.panchang.yoga}` : '—');
    line('IMAGE', a.image ? `${a.image.url}` : '(none matched)');
    line('IMG ALT', a.image ? a.image.alt : '—');
    if (a.image && a.image.shloka) line('IMG SHLOKA', a.image.shloka.replace(/\n/g, ' / '));
    line('FAQ', (a.faq || []).map((f) => f.question).join('  |  ') || '—');
    line('REFS', (a.references || []).map((x) => x.url).join('  ') || '—');
    if (r.usage) line('TOKENS', `in=${r.usage.input_tokens} out=${r.usage.output_tokens}`);
    console.log('\n──────── BODY (first ~900 chars) ────────\n');
    console.log(a.body.slice(0, 900) + (a.body.length > 900 ? '\n…[truncated]' : ''));
    console.log(`\n(body total: ${a.body.split(/\s+/).length} words)`);
    const html = render.articleHtml(a, { site: 'https://www.akara.studio' });
    fs.writeFileSync('/tmp/akara-times-today.html', html);
    console.log('\nFULL RENDERED PAGE → /tmp/akara-times-today.html (' + html.length + ' bytes)\n');
  })
  .catch((e) => { console.error('DRY RUN FAILED:', e); process.exit(1); });
