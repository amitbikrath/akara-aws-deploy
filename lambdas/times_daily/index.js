// akara-times-daily — the daily SEO editorial generator for the Akara Times.
//
// Once a day (EventBridge) or on demand (HTTP): pick ONE topic autonomously
// from panchang/festival, weekday-deity, evergreen, or live-trend signals;
// write a flagship ~900-word article with Claude (web-search grounded when the
// angle calls for it); match an image from the wallpaper corpus by text; then
// emit a crawlable static page at /times/{slug}, refresh the /times index,
// sitemap.xml and robots.txt, and prepend to the in-app feed JSON.
//
// Mirrors the akara-twitter-poller patterns: model + system prompt live in SSM
// (admin-tunable, no redeploy), the Anthropic key is read from the SSM
// SecureString (/akara/anthropic/key) instead of a plaintext env var, prompt
// caching on the system block, and a dual EventBridge/HTTP handler shape.

const { SSMClient, GetParameterCommand, PutParameterCommand } = require('@aws-sdk/client-ssm');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const { Anthropic } = require('@anthropic-ai/sdk');

const { computePanchang, recurringObservances } = require('./panchang');
const { pickTopic, DEITIES } = require('./topics');
const catalog = require('./catalog');
const render = require('./render');

const REGION = process.env.AWS_REGION || 'us-east-1';
const SITE = process.env.SITE_URL || 'https://www.akara.studio';
const ASSETS_BUCKET = process.env.ASSETS_BUCKET || 'akara-assets-738983679688-us-east-1';
const FRONTEND_BUCKET = process.env.FRONTEND_BUCKET || 'akara-frontend-738983679688-us-east-1';
const CATALOG_TABLE = process.env.CATALOG_TABLE || 'akara-catalog';
const DISTRIBUTION_ID = process.env.FRONTEND_DISTRIBUTION_ID || '';
const FEED_KEY = process.env.FEED_KEY || 'editorial/akara-times.json'; // served at /content/editorial/akara-times.json
const MAX_FEED = Number(process.env.MAX_FEED || '60');

const ANTHROPIC_KEY_PARAM = process.env.ANTHROPIC_KEY_PARAM || '/akara/anthropic/key';
const MODEL_PARAM = process.env.MODEL_PARAM || '/akara/times/article_model';
const PROMPT_PARAM = process.env.PROMPT_PARAM || '/akara/times/article_prompt';
const STATE_PARAM = process.env.STATE_PARAM || '/akara/times/topic_state';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'claude-sonnet-4-6';

const ssm = new SSMClient({ region: REGION });
const s3 = new S3Client({ region: REGION });
const cf = new CloudFrontClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const DEFAULT_SYSTEM_PROMPT = `You are the editorial desk of the Akara Times — a devotional broadsheet published from Pune in the spirit of Sanatana Dharma. Akara also crafts devotional wallpapers, music, and art. Your readers are seekers and devotees worldwide.

VOICE: dignified, warm, and rooted. Reverent without being preachy; informative without being dry. You write in clear, modern English, weaving in correct Sanskrit terms (with transliteration and meaning) where they illuminate. Think of a literate temple magazine, not a blog and not clickbait.

EVERY ARTICLE MUST:
- Be a genuine, useful, accurate ~800–1200 word feature on the assigned topic.
- Open with a strong lede, then develop with clear ## subheadings (3–5), and close with a reflection.
- Connect the timeless to the present — the "divine angle" / Akara Sanatan lens.
- Be factually careful. If you used web search, ground claims in it and list real sources.
- Naturally include the suggested keywords for discoverability — never keyword-stuff.
- Be respectful and inclusive across traditions; avoid politics and sectarian dispute.

OUTPUT: Return ONE JSON object only (no prose around it, no code fences) with exactly these fields:
{
  "title": string,            // compelling, accurate headline, ideally <= 70 characters
  "metaTitle": string,        // <= 60 chars, for the HTML <title>
  "metaDescription": string,  // 150–160 chars, includes the primary keyphrase, compelling
  "dek": string,              // one-sentence standfirst/subhead
  "lede": string,             // the opening paragraph as plain text (no markdown)
  "body": string,             // 800–1200 words, markdown: ## subheads, paragraphs, optional - bullets and > quote. Do NOT repeat the title or lede.
  "keywords": string[],       // 8–15 real keyphrases used in the piece
  "category": string,         // one of: Festivals, Deities, Astrology, Philosophy, Scripture
  "deity": string|null,       // primary deity key if any: shiva, vishnu, krishna, rama, hanuman, ganesha, devi, lakshmi, saraswati, surya
  "pullQuote": string|null,   // a short evocative line from the piece, or null
  "faq": [{"question": string, "answer": string}],  // 3–5 genuinely useful Q&As
  "references": [{"title": string, "url": string}]   // sources if web search used, else []
}`;

const ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    metaTitle: { type: 'string' },
    metaDescription: { type: 'string' },
    dek: { type: 'string' },
    lede: { type: 'string' },
    body: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
    category: { type: 'string' },
    deity: { type: ['string', 'null'] },
    pullQuote: { type: ['string', 'null'] },
    faq: {
      type: 'array',
      items: {
        type: 'object',
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
        required: ['question', 'answer'],
        additionalProperties: false,
      },
    },
    references: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, url: { type: 'string' } },
        required: ['title', 'url'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'metaTitle', 'metaDescription', 'dek', 'lede', 'body', 'keywords', 'category'],
  additionalProperties: false,
};

async function getParam(name, { decrypt = false, fallback = null } = {}) {
  if (!name) return fallback;
  try {
    const r = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: decrypt }));
    return r.Parameter?.Value ?? fallback;
  } catch (e) {
    if (e.name === 'ParameterNotFound') return fallback;
    throw e;
  }
}
async function putParam(name, value) {
  await ssm.send(new PutParameterCommand({ Name: name, Value: value, Type: 'String', Overwrite: true }));
}

function istNow(base) {
  // Shift to IST so "today" and weekday reflect the Indian audience.
  const t = (base ? new Date(base) : new Date()).getTime();
  return new Date(t + 5.5 * 3600 * 1000);
}
function istDayKey(d) {
  return new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function extractJson(text) {
  if (!text) throw new Error('empty model output');
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in model output');
  return JSON.parse(s.slice(start, end + 1));
}

async function generateArticle(anthropic, { systemPrompt, model, topic }) {
  const userTurn = `${topic.brief}\n\nSuggested keywords to weave in naturally: ${(topic.keywords || []).join(', ')}.\n\nReturn the single JSON object now.`;

  const baseReq = {
    model,
    max_tokens: 6000,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userTurn }],
  };

  // Web-search angles (festival/trend): give the model the search tool and parse
  // the JSON it returns. Other angles: use structured output for reliability.
  let response;
  if (topic.useWebSearch) {
    try {
      response = await anthropic.messages.create({
        ...baseReq,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      });
    } catch (e) {
      console.warn('web_search unavailable, retrying without tools:', e.message);
      response = await anthropic.messages.create(baseReq);
    }
  } else {
    try {
      response = await anthropic.messages.create({
        ...baseReq,
        output_config: { format: { type: 'json_schema', schema: ARTICLE_SCHEMA } },
      });
    } catch (e) {
      console.warn('structured output unavailable, retrying plain:', e.message);
      response = await anthropic.messages.create(baseReq);
    }
  }

  const textBlocks = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text);
  const text = textBlocks.join('\n').trim();
  const article = extractJson(text);
  return { article, usage: response.usage || {} };
}

function sanitizeArticle(raw, topic, date) {
  const clamp = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  // Clamp at a word boundary (for meta description / title) so tags never end mid-word.
  const wordClamp = (s, n) => {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    const cut = s.slice(0, n);
    const i = cut.lastIndexOf(' ');
    return (i > 40 ? cut.slice(0, i) : cut).replace(/[\s,;:.–—-]+$/, '');
  };
  const deityKey = (raw.deity && DEITIES[raw.deity] ? raw.deity : topic.deity) || null;
  const d = deityKey ? DEITIES[deityKey] : null;
  const title = clamp(raw.title || topic.workingTitle, 120);
  const article = {
    slug: render.slugify(title, date),
    title,
    metaTitle: wordClamp(raw.metaTitle || title, 62),
    metaDescription: wordClamp(raw.metaDescription || raw.dek || '', 158),
    dek: clamp(raw.dek, 220),
    lede: String(raw.lede || '').trim(),
    body: String(raw.body || '').trim(),
    keywords: Array.from(new Set((raw.keywords || topic.keywords || []).map((k) => String(k).toLowerCase().trim()).filter(Boolean))).slice(0, 15),
    category: raw.category || topic.category,
    angle: topic.angle,
    deity: deityKey,
    deityDisplay: d ? d.display : topic.deityDisplay || null,
    deitySameAs: d ? d.sameAs : null,
    festivalName: topic.festivalName || null,
    pullQuote: raw.pullQuote ? clamp(raw.pullQuote, 240) : null,
    faq: Array.isArray(raw.faq) ? raw.faq.filter((f) => f && f.question && f.answer).slice(0, 6) : [],
    references: Array.isArray(raw.references) ? raw.references.filter((r) => r && r.url).slice(0, 8) : [],
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
  };
  if (!article.body || article.body.length < 400) throw new Error('article body too short — refusing to publish');
  return article;
}

async function readFeed() {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: ASSETS_BUCKET, Key: FEED_KEY }));
    const txt = await r.Body.transformToString();
    const j = JSON.parse(txt);
    return Array.isArray(j.articles) ? j.articles : [];
  } catch (e) {
    // Missing key without s3:ListBucket surfaces as AccessDenied, not NoSuchKey.
    if (['NoSuchKey', 'AccessDenied'].includes(e.name) || e.Code === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return [];
    console.warn('readFeed failed (continuing with empty):', e.message);
    return [];
  }
}

function feedEntry(a) {
  // Compact entry for the in-app Edition feed (socials.jsx).
  return {
    slug: a.slug,
    url: `/times/${a.slug}`,
    title: a.title,
    dek: a.dek,
    lede: a.lede,
    category: a.category,
    angle: a.angle,
    deity: a.deity,
    deityDisplay: a.deityDisplay,
    festivalName: a.festivalName,
    image: a.image ? { url: a.image.url, alt: a.image.alt, width: a.image.width, height: a.image.height } : null,
    datePublished: a.datePublished,
    panchang: a.panchang,
  };
}

async function putObject(bucket, key, body, contentType, cacheControl) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }));
}

async function invalidate(paths) {
  if (!DISTRIBUTION_ID) {
    console.warn('no FRONTEND_DISTRIBUTION_ID — skipping CloudFront invalidation');
    return;
  }
  await cf.send(
    new CreateInvalidationCommand({
      DistributionId: DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: `times-${Date.now()}`,
        Paths: { Quantity: paths.length, Items: paths },
      },
    })
  );
}

async function run(opts = {}) {
  const dryRun = !!opts.dryRun;
  const baseInstant = opts.date ? new Date(opts.date) : new Date();
  const date = istNow(opts.date);
  const weekday = date.getUTCDay(); // IST weekday (date already shifted)

  const [apiKey, model, systemPrompt, stateRaw] = await Promise.all([
    getParam(ANTHROPIC_KEY_PARAM, { decrypt: true }),
    getParam(MODEL_PARAM, { fallback: DEFAULT_MODEL }),
    getParam(PROMPT_PARAM, { fallback: DEFAULT_SYSTEM_PROMPT }),
    getParam(STATE_PARAM, { fallback: '{}' }),
  ]);
  if (!apiKey) throw new Error(`Anthropic key not found at SSM ${ANTHROPIC_KEY_PARAM}`);
  let state = {};
  try { state = JSON.parse(stateRaw || '{}'); } catch { state = {}; }

  const panchang = computePanchang(baseInstant);
  const observances = recurringObservances(panchang);
  const { topic, state: nextState } = pickTopic({ date, weekday, panchang, observances, state });
  console.log(`[times] ${date.toISOString().slice(0, 10)} weekday=${weekday} angle=${topic.angle} title="${topic.workingTitle}" obs=${observances.map((o) => o.key).join(',') || '-'}`);

  // Idempotency: one flagship article per day. If today's already published,
  // skip (protects against double-fires / async retries). force=true overrides.
  const existing = await readFeed();
  if (!opts.force && existing[0] && istDayKey(existing[0].datePublished) === istDayKey(baseInstant)) {
    console.log(`[times] already published today (${existing[0].slug}); skipping. Pass force=true to regenerate.`);
    return { ok: true, skipped: true, slug: existing[0].slug, date: istDayKey(baseInstant) };
  }

  const anthropic = new Anthropic({ apiKey });
  const { article: raw, usage } = await generateArticle(anthropic, { systemPrompt, model, topic });
  const article = sanitizeArticle(raw, topic, date);
  article.panchang = {
    tithi: panchang.tithi, paksha: panchang.paksha, nakshatra: panchang.nakshatra,
    pada: panchang.pada, yoga: panchang.yoga, solarMonth: panchang.solarMonth,
  };

  // Image from the corpus.
  let imageInfo = null;
  try {
    const wallpapers = await catalog.fetchWallpapers(ddb, CATALOG_TABLE);
    const terms = Array.from(new Set([...(topic.imageQuery?.terms || []), ...(article.deity && DEITIES[article.deity] ? DEITIES[article.deity].epithets : [])]));
    const picked = catalog.pickImage(wallpapers, { deity: article.deity, terms });
    if (picked) {
      imageInfo = catalog.buildImage(picked.item, article.deityDisplay, SITE);
      console.log(`[times] image score=${picked.score} -> ${imageInfo.url}`);
    }
  } catch (e) {
    console.warn('image match failed (continuing without image):', e.message);
  }
  article.image = imageInfo;

  // Build outputs.
  const todayKey = istDayKey(article.datePublished);
  const feed = [feedEntry(article), ...existing.filter((e) => istDayKey(e.datePublished) !== todayKey)].slice(0, MAX_FEED);
  const articlePage = render.articleHtml(article, { site: SITE });
  const indexPage = render.indexHtml(feed, { site: SITE });
  const sitemap = render.sitemapXml([
    { loc: `${SITE}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE}/times`, lastmod: article.datePublished, changefreq: 'daily', priority: '0.9' },
    ...feed.map((a) => ({ loc: `${SITE}/times/${a.slug}`, lastmod: a.datePublished, changefreq: 'monthly', priority: '0.7' })),
  ]);
  const robots = render.robotsTxt(SITE);

  if (dryRun) {
    console.log('[times] DRY RUN — no writes');
    return { ok: true, dryRun: true, topic: topic.angle, slug: article.slug, article, usage, sampleHtmlLength: articlePage.length };
  }

  // The www CloudFront function (akara-admin-url-rewrite) appends ".html" to
  // extensionless paths, so /times/{slug} → times/{slug}.html and /times →
  // times.html. Write the keys that rewrite resolves to.
  await Promise.all([
    putObject(FRONTEND_BUCKET, `times/${article.slug}.html`, articlePage, 'text/html; charset=utf-8', 'public, max-age=3600'),
    putObject(FRONTEND_BUCKET, 'times.html', indexPage, 'text/html; charset=utf-8', 'public, max-age=600'),
    putObject(FRONTEND_BUCKET, 'sitemap.xml', sitemap, 'application/xml', 'public, max-age=600'),
    putObject(FRONTEND_BUCKET, 'robots.txt', robots, 'text/plain', 'public, max-age=3600'),
    putObject(ASSETS_BUCKET, FEED_KEY, JSON.stringify({ updated_at: new Date().toISOString(), articles: feed }), 'application/json', 'public, max-age=300'),
  ]);
  await putParam(STATE_PARAM, JSON.stringify(nextState));
  await invalidate(['/times*', '/sitemap.xml', '/robots.txt', '/content/editorial/akara-times.json']);

  return { ok: true, angle: topic.angle, slug: article.slug, title: article.title, category: article.category, deity: article.deity, hasImage: !!article.image, usage };
}

function httpResponse(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) };
}

exports.run = run;

exports.handler = async (event = {}) => {
  const isHttp = Boolean(event.requestContext);
  let opts = {};
  if (isHttp && event.body) {
    try { opts = JSON.parse(event.body) || {}; } catch { opts = {}; }
  } else if (!isHttp) {
    opts = event || {};
  }
  console.log('Trigger:', isHttp ? 'http' : event.source || 'manual', 'opts:', JSON.stringify(opts));
  try {
    const result = await run(opts);
    return isHttp ? httpResponse(200, result) : result;
  } catch (err) {
    console.error('times-daily failed:', err);
    if (isHttp) return httpResponse(500, { ok: false, error: err.message });
    throw err;
  }
};

// Allow local dry-run: `node index.js` (no AWS writes if --dry).
if (require.main === module) {
  run({ dryRun: true }).then((r) => console.log(JSON.stringify(r, null, 2))).catch((e) => { console.error(e); process.exit(1); });
}
