const { SSMClient, GetParameterCommand, PutParameterCommand } = require('@aws-sdk/client-ssm');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Anthropic } = require('@anthropic-ai/sdk');

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
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const ssm = new SSMClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

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

async function generateArticle({ media, systemPrompt, model }) {
  if (!anthropic) {
    return null;
  }
  try {
    const kind = mediaKindLabel(media.media_type);
    const caption = media.caption || '(no caption)';

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
          content: `Instagram ${kind} to file on.\n\nCaption:\n${caption}\n\nPosted ${media.timestamp}.\nPermalink: ${media.permalink}`,
        },
      ],
      output_config: {
        format: { type: 'json_schema', schema: ARTICLE_SCHEMA },
      },
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) return null;
    return {
      article: JSON.parse(textBlock.text),
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: response.usage.cache_read_input_tokens || 0,
      },
    };
  } catch (err) {
    console.error(`Claude generation failed for IG media ${media.id}:`, err.message);
    return null;
  }
}

async function writePostsJson({ media, systemPrompt, model }) {
  const display = media.slice(0, POSTS_DISPLAY_COUNT);
  const generated = await Promise.all(
    display.map(async (m) => {
      const result = await generateArticle({ media: m, systemPrompt, model });
      return {
        id: m.id,
        url: m.permalink,
        caption: m.caption || '',
        media_type: m.media_type,
        media_url: m.media_url,
        thumbnail_url: m.thumbnail_url || null,
        created_at: m.timestamp,
        article: result?.article || null,
      };
    })
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

    const media = await fetchLatestMedia();
    // IG IDs are numeric strings — BigInt comparison is safe and consistent.
    const newOnes = sinceId
      ? media.filter((m) => BigInt(m.id) > BigInt(sinceId))
      : media;

    console.log(
      `since_id=${sinceId || '(none)'} fetched=${media.length} new=${newOnes.length} model=${model}`
    );

    const wire = await writePostsJson({ media, systemPrompt, model });

    if (media.length > 0) {
      await setLastSeenId(media[0].id);
    }

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
