// akara-instagram-poller — reads the Instagram Graph feed and files each post
// through the Editorial Desk (shared Lambda layer, see CONTEXT.md).
const { createDesk } = require('@akara/editorial-desk');

const PAGE_TOKEN = process.env.IG_PAGE_ACCESS_TOKEN;
const IG_USER_ID = process.env.IG_BUSINESS_ACCOUNT_ID;
const TARGET_HANDLE = process.env.IG_TARGET_HANDLE || 'akaraxstudio';
const GRAPH_API_VERSION = process.env.IG_GRAPH_API_VERSION || 'v21.0';
const LAST_ID_PARAM = process.env.LAST_SEEN_PARAM_NAME;
const ARTICLE_PROMPT_PARAM = process.env.ARTICLE_PROMPT_PARAM_NAME;
const ARTICLE_MODEL_PARAM = process.env.ARTICLE_MODEL_PARAM_NAME;
const POSTS_BUCKET = process.env.INSTAGRAM_POSTS_S3_BUCKET;
const POSTS_KEY = process.env.INSTAGRAM_POSTS_S3_KEY;
const POSTS_DISPLAY_COUNT = Number(process.env.INSTAGRAM_POSTS_DISPLAY_COUNT || '4');
const MAX_TOKENS = 1500;

const desk = createDesk({ region: process.env.AWS_REGION, apiKey: process.env.ANTHROPIC_API_KEY });

const ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    dek: { type: 'string' },
    lede: { type: 'string' },
    body: { type: 'string' },
  },
  required: ['headline', 'dek', 'lede', 'body'],
  additionalProperties: false,
};

async function getLastSeenId() {
  const v = await desk.getParam(LAST_ID_PARAM);
  return v && v !== '0' ? v : null;
}

// IG Graph API — pull recent media for the business account. Carousels return
// only the cover; their child media URLs would require a per-item follow-up
// fetch (skipped for v1 — the embed widget handles the carousel UI itself).
async function fetchLatestMedia() {
  const fields = [
    'id',
    'caption',
    'media_type',          // IMAGE | VIDEO | CAROUSEL_ALBUM
    'media_url',           // direct CDN URL (signed, expires)
    'permalink',           // canonical instagram.com URL — what IGEmbed needs
    'timestamp',           // ISO 8601
    'thumbnail_url',       // VIDEO only — poster frame
  ].join(',');

  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${IG_USER_ID}/media`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('limit', '10');
  url.searchParams.set('access_token', PAGE_TOKEN);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`IG Graph API ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.error) {
    throw new Error(`IG Graph API error: ${json.error.message}`);
  }
  return json.data || [];
}

function mediaKindLabel(media_type) {
  if (media_type === 'VIDEO') return 'reel';
  if (media_type === 'CAROUSEL_ALBUM') return 'carousel';
  return 'photograph';
}


async function articleFor(media, { systemPrompt, model }) {
  try {
    const { article } = await desk.writeArticle({
      model,
      system: systemPrompt,
      user: `Instagram ${mediaKindLabel(media.media_type)} to file on.\n\nCaption:\n${media.caption || '(no caption)'}\n\nPosted ${media.timestamp}.\nPermalink: ${media.permalink}`,
      schema: ARTICLE_SCHEMA,
      maxTokens: MAX_TOKENS,
    });
    return article;
  } catch (err) {
    console.error(`Claude generation failed for IG media ${media.id}:`, err.message);
    return null;
  }
}

async function writePostsJson({ media, systemPrompt, model }) {
  const display = media.slice(0, POSTS_DISPLAY_COUNT);
  const posts = await Promise.all(
    display.map(async (m) => ({
      id: m.id,
      url: m.permalink,
      caption: m.caption || '',
      media_type: m.media_type,
      media_url: m.media_url,
      thumbnail_url: m.thumbnail_url || null,
      created_at: m.timestamp,
      article: await articleFor(m, { systemPrompt, model }),
    }))
  );
  const payload = { updated_at: new Date().toISOString(), handle: TARGET_HANDLE, model, posts };
  await desk.publish({
    bucket: POSTS_BUCKET, key: POSTS_KEY, body: JSON.stringify(payload),
    contentType: 'application/json', cacheControl: 'public, max-age=300',
  });
  return payload;
}

function httpResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

// ── Admin guard (2026-10-07) ─────────────────────────────────────────────
// The /api/*/refresh route shares one JWT authorizer with the public site, and
// the user pool allows self sign-up, so the gateway alone lets ANY signed-in
// visitor trigger a paid poll. HTTP calls must carry the Cognito "admin" group.
// Scheduled EventBridge runs have no requestContext and skip this check.
function _akDeny(event) {
  const rc = event.requestContext;
  if (!rc) return 0;
  const method = (rc.http && rc.http.method) || event.httpMethod;
  if (method === 'OPTIONS') return 0;
  const a = rc.authorizer || {};
  const claims = (a.jwt && a.jwt.claims) || a.claims || null;
  if (!claims) return 401;
  const g = claims['cognito:groups'];
  const groups = Array.isArray(g) ? g : String(g || '').replace(/[\[\]"]/g, '').split(/[\s,]+/).filter(Boolean);
  return groups.includes('admin') ? 0 : 403;
}

exports.handler = async (event) => {
  const isHttp = Boolean(event.requestContext);
  console.log('Trigger:', isHttp ? 'http' : event.source || 'unknown');
  const denied = _akDeny(event);
  if (denied) return httpResponse(denied, { ok: false, error: denied === 403 ? 'Admin only' : 'Unauthorized' });
  try {
    const [sinceId, systemPrompt, model] = await Promise.all([
      getLastSeenId(),
      desk.getParam(ARTICLE_PROMPT_PARAM, { fallback: '' }),
      desk.getParam(ARTICLE_MODEL_PARAM, { fallback: 'claude-sonnet-4-6' }),
    ]);

    const media = await fetchLatestMedia();
    const newOnes = sinceId ? media.filter((m) => BigInt(m.id) > BigInt(sinceId)) : media;
    console.log(`since_id=${sinceId || '(none)'} fetched=${media.length} new=${newOnes.length} model=${model}`);

    const wire = await writePostsJson({ media, systemPrompt, model });
    if (media.length > 0) await desk.putParam(LAST_ID_PARAM, media[0].id);

    const result = {
      ok: true,
      sinceId: sinceId || null,
      fetched: media.length,
      newPosts: newOnes.length,
      wirePosts: wire.posts.length,
      articlesGenerated: wire.posts.filter((p) => p.article).length,
      model,
      newLastSeenId: media[0]?.id || sinceId || null,
    };
    return isHttp ? httpResponse(200, result) : result;
  } catch (err) {
    console.error('IG poller failed:', err);
    if (isHttp) return httpResponse(500, { ok: false, error: err.message });
    throw err;
  }
};
