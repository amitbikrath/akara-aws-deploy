// akara-twitter-poller — reads the X feed and files each post through the
// Editorial Desk (shared Lambda layer, see CONTEXT.md).
const { createDesk } = require('@akara/editorial-desk');

const BEARER = process.env.X_BEARER_TOKEN;
const TARGET_USER_ID = process.env.X_TARGET_USER_ID;
const TARGET_HANDLE = process.env.X_TARGET_HANDLE || 'akara__1';
const LAST_ID_PARAM = process.env.LAST_SEEN_PARAM_NAME;
const ARTICLE_PROMPT_PARAM = process.env.ARTICLE_PROMPT_PARAM_NAME;
const ARTICLE_MODEL_PARAM = process.env.ARTICLE_MODEL_PARAM_NAME;
const POSTS_BUCKET = process.env.TWITTER_POSTS_S3_BUCKET;
const POSTS_KEY = process.env.TWITTER_POSTS_S3_KEY;
const POSTS_DISPLAY_COUNT = Number(process.env.TWITTER_POSTS_DISPLAY_COUNT || '4');
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

async function fetchLatestTweets() {
  const url = new URL(`https://api.x.com/2/users/${TARGET_USER_ID}/tweets`);
  url.searchParams.set('max_results', '10');
  url.searchParams.set('exclude', 'retweets,replies');
  url.searchParams.set('tweet.fields', 'created_at,referenced_tweets');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${BEARER}` } });
  if (!res.ok) throw new Error(`X API ${res.status}: ${await res.text()}`);
  return (await res.json()).data || [];
}

function isOriginalPost(t) {
  return !(t.referenced_tweets || []).some((r) => r.type === 'quoted');
}

function tweetUrl(id) {
  return `https://twitter.com/${TARGET_HANDLE}/status/${id}`;
}

// A failed article is not fatal: the post ships with article=null and the
// frontend uses its fallback layout.
async function articleFor(tweet, { systemPrompt, model }) {
  try {
    const { article } = await desk.writeArticle({
      model,
      system: systemPrompt,
      user: `Tweet to file on:\n\n${tweet.text}\n\nPosted ${tweet.created_at}.`,
      schema: ARTICLE_SCHEMA,
      maxTokens: MAX_TOKENS,
    });
    return article;
  } catch (err) {
    console.error(`Claude generation failed for tweet ${tweet.id}:`, err.message);
    return null;
  }
}

async function writePostsJson({ originals, systemPrompt, model }) {
  const display = originals.slice(0, POSTS_DISPLAY_COUNT);
  const posts = await Promise.all(
    display.map(async (t) => ({
      id: t.id,
      url: tweetUrl(t.id),
      text: t.text,
      created_at: t.created_at,
      article: await articleFor(t, { systemPrompt, model }),
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

    const tweets = await fetchLatestTweets();
    const original = tweets.filter(isOriginalPost);
    const newOnes = sinceId ? original.filter((t) => BigInt(t.id) > BigInt(sinceId)) : original;
    console.log(`since_id=${sinceId || '(none)'} fetched=${tweets.length} original=${original.length} new=${newOnes.length} model=${model}`);

    const wire = await writePostsJson({ originals: original, systemPrompt, model });
    if (tweets.length > 0) await desk.putParam(LAST_ID_PARAM, tweets[0].id);

    const result = {
      ok: true,
      sinceId: sinceId || null,
      fetched: tweets.length,
      originalPosts: original.length,
      newPosts: newOnes.length,
      wirePosts: wire.posts.length,
      articlesGenerated: wire.posts.filter((p) => p.article).length,
      model,
      newLastSeenId: tweets[0]?.id || sinceId || null,
    };
    return isHttp ? httpResponse(200, result) : result;
  } catch (err) {
    console.error('Poller failed:', err);
    if (isHttp) return httpResponse(500, { ok: false, error: err.message });
    throw err;
  }
};
