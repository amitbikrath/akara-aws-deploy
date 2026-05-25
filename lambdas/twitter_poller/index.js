const { SSMClient, GetParameterCommand, PutParameterCommand } = require('@aws-sdk/client-ssm');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Anthropic } = require('@anthropic-ai/sdk');

const BEARER = process.env.X_BEARER_TOKEN;
const TARGET_USER_ID = process.env.X_TARGET_USER_ID;
const TARGET_HANDLE = process.env.X_TARGET_HANDLE || 'akara__1';
const LAST_ID_PARAM = process.env.LAST_SEEN_PARAM_NAME;
const ARTICLE_PROMPT_PARAM = process.env.ARTICLE_PROMPT_PARAM_NAME;
const ARTICLE_MODEL_PARAM = process.env.ARTICLE_MODEL_PARAM_NAME;
const POSTS_BUCKET = process.env.TWITTER_POSTS_S3_BUCKET;
const POSTS_KEY = process.env.TWITTER_POSTS_S3_KEY;
const POSTS_DISPLAY_COUNT = Number(process.env.TWITTER_POSTS_DISPLAY_COUNT || '4');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const ssm = new SSMClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// json_schema enforced via output_config.format. Sonnet 4.6 supports
// structured outputs, so the response.content[0].text is guaranteed to parse
// into this shape.
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

async function getParam(name, fallback = null) {
  if (!name) return fallback;
  try {
    const r = await ssm.send(new GetParameterCommand({ Name: name }));
    return r.Parameter?.Value ?? fallback;
  } catch (e) {
    if (e.name === 'ParameterNotFound') return fallback;
    throw e;
  }
}

async function getLastSeenId() {
  const v = await getParam(LAST_ID_PARAM);
  return v && v !== '0' ? v : null;
}

async function setLastSeenId(id) {
  await ssm.send(
    new PutParameterCommand({
      Name: LAST_ID_PARAM,
      Value: id,
      Type: 'String',
      Overwrite: true,
    })
  );
}

async function fetchLatestTweets() {
  const url = new URL(`https://api.x.com/2/users/${TARGET_USER_ID}/tweets`);
  url.searchParams.set('max_results', '10');
  url.searchParams.set('exclude', 'retweets,replies');
  url.searchParams.set('tweet.fields', 'created_at,referenced_tweets');

  const res = await fetch(url, { headers: { Authorization: `Bearer ${BEARER}` } });
  if (!res.ok) {
    throw new Error(`X API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()).data || [];
}

function isOriginalPost(t) {
  return !(t.referenced_tweets || []).some((r) => r.type === 'quoted');
}

function tweetUrl(id) {
  return `https://twitter.com/${TARGET_HANDLE}/status/${id}`;
}

// Generate a newspaper-style article from one tweet using Claude. The system
// prompt and model are read from SSM at invocation time so admin can tune
// them without redeploying. cache_control on the system block makes calls
// 2..N of a polling run hit the prompt cache (~10% the price).
async function generateArticle({ tweet, systemPrompt, model }) {
  if (!anthropic) {
    return null; // API key missing — frontend uses a fallback layout
  }
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Tweet to file on:\n\n${tweet.text}\n\nPosted ${tweet.created_at}.`,
        },
      ],
      output_config: {
        format: { type: 'json_schema', schema: ARTICLE_SCHEMA },
      },
    });

    // Find the text block (skip any thinking blocks) and parse.
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) return null;
    const article = JSON.parse(textBlock.text);

    return {
      article,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: response.usage.cache_read_input_tokens || 0,
      },
    };
  } catch (err) {
    console.error(`Claude generation failed for tweet ${tweet.id}:`, err.message);
    return null;
  }
}

async function writePostsJson({ originals, systemPrompt, model }) {
  const display = originals.slice(0, POSTS_DISPLAY_COUNT);
  const generated = await Promise.all(
    display.map(async (t) => {
      const result = await generateArticle({ tweet: t, systemPrompt, model });
      return {
        id: t.id,
        url: tweetUrl(t.id),
        text: t.text,
        created_at: t.created_at,
        article: result?.article || null,
      };
    })
  );

  const totals = generated.reduce(
    (acc, _, i) => {
      // We don't currently store usage per-post, just log the aggregate
      return acc;
    },
    { input: 0, output: 0, cache_read: 0, cache_create: 0 }
  );

  const payload = {
    updated_at: new Date().toISOString(),
    handle: TARGET_HANDLE,
    model,
    posts: generated,
  };

  await s3.send(
    new PutObjectCommand({
      Bucket: POSTS_BUCKET,
      Key: POSTS_KEY,
      Body: JSON.stringify(payload),
      ContentType: 'application/json',
      CacheControl: 'public, max-age=300',
    })
  );

  return payload;
}

function httpResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const isHttp = Boolean(event.requestContext);
  console.log('Trigger:', isHttp ? 'http' : event.source || 'unknown');

  try {
    const [sinceId, systemPrompt, model] = await Promise.all([
      getLastSeenId(),
      getParam(ARTICLE_PROMPT_PARAM, ''),
      getParam(ARTICLE_MODEL_PARAM, 'claude-sonnet-4-6'),
    ]);

    const tweets = await fetchLatestTweets();
    const original = tweets.filter(isOriginalPost);
    const newOnes = sinceId
      ? original.filter((t) => BigInt(t.id) > BigInt(sinceId))
      : original;

    console.log(
      `since_id=${sinceId || '(none)'} fetched=${tweets.length} original=${original.length} new=${newOnes.length} model=${model}`
    );

    const wire = await writePostsJson({ originals: original, systemPrompt, model });

    if (tweets.length > 0) {
      await setLastSeenId(tweets[0].id);
    }

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
