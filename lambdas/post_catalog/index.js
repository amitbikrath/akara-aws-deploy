const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);
const lambda = new LambdaClient({ region: process.env.AWS_REGION });
// A new wallpaper starts Darśana tagging at once (it then rebuilds the Darśana
// catalog). The 10-min EventBridge timer stays as the backup.
const ENRICH_FN = process.env.ENRICH_FN || 'akara-darshan-enrich';

const WALL_DISPLAY_SETTINGS_TITLE = 'wall_display_settings';

function normalizeWallDisplayBodyString(bodyStr) {
  if (typeof bodyStr !== 'string' || !bodyStr.trim()) return bodyStr;
  try {
    const o = JSON.parse(bodyStr);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return bodyStr;
    const tm = o.tileMode;
    if (typeof tm === 'string') {
      const m = tm.trim().toLowerCase();
      const aliases = {
        colour: 'color',
        gray: 'grayscale',
        grey: 'grayscale',
        greyscale: 'grayscale',
        gray_scale: 'grayscale',
        bw: 'grayscale',
        mono: 'grayscale',
        black_and_white: 'grayscale'
      };
      const mode = aliases[m] || m;
      if (['grayscale', 'color', 'tint'].includes(mode)) o.tileMode = mode;
    }
    return JSON.stringify(o);
  } catch {
    return bodyStr;
  }
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type,x-akara-api-key,authorization',
  'Access-Control-Allow-Credentials': true
};

// ── Admin guard (2026-10-07) ─────────────────────────────────────────────
// Every /api/* JWT route shares one authorizer with the public site, and the
// user pool allows self sign-up, so the gateway alone lets ANY signed-in
// visitor through. Require the Cognito "admin" group on JWT calls; calls with
// no JWT (the /ios/* routes) must carry the iOS API key.
function _akClaims(event) {
  const a = (event.requestContext && event.requestContext.authorizer) || {};
  return (a.jwt && a.jwt.claims) || a.claims || null;
}
function _akDeny(event) {
  const method = (event.requestContext && event.requestContext.http && event.requestContext.http.method) || event.httpMethod;
  if (method === 'OPTIONS') return 0;
  const claims = _akClaims(event);
  if (claims) {
    const g = claims['cognito:groups'];
    const groups = Array.isArray(g) ? g : String(g || '').replace(/[\[\]"]/g, '').split(/[\s,]+/).filter(Boolean);
    return groups.includes('admin') ? 0 : 403;
  }
  const h = event.headers || {};
  const key = h['x-akara-api-key'] || h['X-Akara-Api-Key'] || h['X-AKARA-API-KEY'];
  return process.env.IOS_API_KEY && key === process.env.IOS_API_KEY ? 0 : 401;
}

const _akHandler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const method = event.requestContext?.http?.method || 'POST';

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const headers = event.headers || {};
  const authHeader = headers.authorization || headers.Authorization || headers.AUTHORIZATION;
  if (!authHeader) {
    const expectedApiKey = process.env.IOS_API_KEY;
    const providedApiKey =
      headers['x-akara-api-key'] ||
      headers['X-Akara-Api-Key'] ||
      headers['X-AKARA-API-KEY'];
    if (!expectedApiKey || !providedApiKey || providedApiKey !== expectedApiKey) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Unauthorized' })
      };
    }
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const {
      type,
      title,
      caption,
      shloka,
      meaning,
      fileKey,
      thumbKey,
      ratio,
      palette,
      style,
      lyrics,
      albumArtKey,
      mediaType,
      mimeType,
      body: contentBody,
      contactEmail,
      contactPhone,
      contactAddress,
      contactInstagram,
      storyImageKey,
      storyImageFocusX,
      storyImageFocusY,
      // AI tags the iOS app already computes on-device (Claude auto-tagger).
      // Accepting them here means app uploads arrive pre-organized and never
      // enter the admin Organize queue.
      deities,
      moodTag,
      tags,
      orientation,
      // Carousel: extra image keys after `fileKey` (cover). The iOS strip-cut
      // flow posts one wide artwork as N strips; the site shows them side by
      // side (panorama) and the lightbox swipes across them.
      slideKeys,
      // "strip" (one artwork cut into strips) or "carousel" (separate images).
      // Only meaningful with slideKeys; missing → the site treats it as "strip".
      layout,
      // The app's own post id. Post Now and the akara-poster timer both send
      // it, so a retry lands on the same row instead of making a second one.
      clientId
    } = body;

    // Validate required fields
    if (!type || !title) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({
          error: 'Missing required fields: type, title'
        })
      };
    }

    if (!['wallpaper', 'music', 'site'].includes(type)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({
          error: 'Type must be "wallpaper", "music", or "site"'
        })
      };
    }

    if (type !== 'site' && !fileKey) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({
          error: 'Missing required field: fileKey (required for wallpaper/music)'
        })
      };
    }

    // Generate IDs
    const cleanClientId = typeof clientId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(clientId) ? clientId : '';
    const id = cleanClientId || randomUUID();
    const version = '1';
    const createdAt = new Date().toISOString();

    const focusX = Number.isFinite(Number(storyImageFocusX)) ? Number(storyImageFocusX) : 50;
    const focusY = Number.isFinite(Number(storyImageFocusY)) ? Number(storyImageFocusY) : 50;

    let storedSiteBody = contentBody || '';
    if (
      type === 'site' &&
      title === WALL_DISPLAY_SETTINGS_TITLE &&
      typeof storedSiteBody === 'string'
    ) {
      storedSiteBody = normalizeWallDisplayBodyString(storedSiteBody);
    }

    // Create DynamoDB item
    const item = {
      pk: `${type.toUpperCase()}#${id}`,
      sk: `v#${version}`,
      type,
      title,
      caption: caption || '',
      shloka: shloka || '',
      meaning: meaning || '',
      fileKey: fileKey || '',
      thumbKey: thumbKey || '',
      ratio: ratio || '16:9',
      palette: palette || [],
      style: style || '',
      lyrics: lyrics || '',
      albumArtKey: albumArtKey || '',
      mediaType: mediaType || (type === 'music' ? 'audio' : 'image'),
      mimeType: mimeType || '',
      body: storedSiteBody,
      contactEmail: contactEmail || '',
      contactPhone: contactPhone || '',
      contactAddress: contactAddress || '',
      contactInstagram: contactInstagram || '',
      storyImageKey: storyImageKey || '',
      storyImageFocusX: Math.min(100, Math.max(0, focusX)),
      storyImageFocusY: Math.min(100, Math.max(0, focusY)),
      deities: Array.isArray(deities) ? deities : [],
      moodTag: moodTag || '',
      tags: Array.isArray(tags) ? tags : [],
      orientation: orientation || '',
      slideKeys: Array.isArray(slideKeys) ? slideKeys.filter((k) => typeof k === 'string' && k).slice(0, 10) : [],
      createdAt
    };
    if (item.slideKeys.length && ['strip', 'carousel'].includes(layout)) item.layout = layout;
    if (cleanClientId) item.clientId = cleanClientId;

    // Save to DynamoDB
    try {
      await docClient.send(new PutCommand({
        TableName: process.env.CATALOG_TABLE,
        Item: item,
        ...(cleanClientId ? { ConditionExpression: 'attribute_not_exists(pk)' } : {})
      }));
    } catch (err) {
      if (cleanClientId && err.name === 'ConditionalCheckFailedException') {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ id, version, duplicate: true, message: 'Catalog item already exists' })
        };
      }
      throw err;
    }

    if (type === 'wallpaper') {
      try {
        await lambda.send(new InvokeCommand({ FunctionName: ENRICH_FN, InvocationType: 'Event', Payload: JSON.stringify({ source: 'post-catalog', id }) }));
      } catch (e) {
        console.warn('enrich trigger failed (timer will pick it up):', e.name || e);
      }
    }

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        id,
        version,
        message: 'Catalog item created successfully',
        item: {
          id,
          version,
          type,
          title,
          fileKey,
          createdAt
        }
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
};




exports.handler = async (event) => {
  const denied = _akDeny(event);
  if (denied) {
    return {
      statusCode: denied,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: denied === 403 ? 'Admin only' : 'Unauthorized' }),
    };
  }
  return _akHandler(event);
};
