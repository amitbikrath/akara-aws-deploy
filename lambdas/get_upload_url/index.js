const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');

const s3Client = new S3Client({ region: process.env.AWS_REGION });

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

  // /api/* = JWT at gateway; /ios/* = validate x-akara-api-key here (same Lambda integration).
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
    const { contentType, fileExt, type } = body;

    // Validate input
    if (!contentType || !fileExt || !type) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Missing required fields: contentType, fileExt, type'
        })
      };
    }

    if (!['wallpaper', 'music', 'site'].includes(type)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Type must be "wallpaper", "music", or "site"'
        })
      };
    }

    // Generate unique key
    const uuid = randomUUID();
    const key = `originals/${uuid}.${fileExt}`;

    // Create presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: process.env.ASSETS_BUCKET,
      Key: key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        uploadUrl,
        key
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
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
