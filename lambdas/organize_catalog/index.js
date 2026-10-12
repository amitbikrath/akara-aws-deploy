// organize_catalog — AI-assisted metadata review queue for the wallpaper
// catalog, modeled on the iOS app's Pinterest sync flow (load a small batch,
// Claude suggests, admin approves/corrects, decisions become few-shot for the
// next batch).
//
//   GET  /api/catalog/organize?limit=8   → review cards with AI suggestions
//   POST /api/catalog/organize           → record a decision (apply | skip)
//
// Field vocabulary deliberately matches the iOS app's MediaItem (`deities`
// array, `moodTag` string, same mood lattice) so tags stay consistent across
// projects and future iOS uploads can pass theirs through unchanged.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient, QueryCommand, GetCommand, UpdateCommand, PutCommand,
} = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { randomUUID } = require('crypto');

const REGION = process.env.AWS_REGION || 'us-east-1';
const CATALOG_TABLE = process.env.CATALOG_TABLE || 'akara-catalog';
const ASSETS_BUCKET = process.env.ASSETS_BUCKET;
const ANTHROPIC_KEY_PARAM = process.env.ANTHROPIC_KEY_PARAM || '/akara/anthropic/key';
const MODEL = process.env.ORGANIZE_MODEL || 'claude-sonnet-4-6';
const SITE_URL = process.env.SITE_URL || 'https://www.akara.studio';
const DECISION_TYPE = 'organize_decision';
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3 = new S3Client({ region: REGION });
const ssm = new SSMClient({ region: REGION });

// Same mood lattice + deity canon as the iOS app's auto-tagger.
const MOODS = ['devotional', 'cosmic', 'serene', 'fierce', 'joyful', 'mystical', 'contemplative'];
// Core list; deities the AI added later are appended at run time from the
// shared registry (lambdas/darshan_enrich/deity_registry.py).
const DEITY_CANON = ['Shiva', 'Krishna', 'Ganesha', 'Hanuman', 'Devi', 'Durga', 'Kali', 'Lakshmi', 'Saraswati', 'Vishnu', 'Rama', 'Narasimha', 'Murugan', 'Surya', 'Radha', 'Parvati', 'Sita'];
// Darśana facets — suggestions are precomputed by akara/scripts/darshan_suggest.py
// into `aiSuggestion`; the queue serves those instead of calling Claude live.
const COUPLES = ['radha-krishna', 'shiva-parvati', 'sita-rama', 'lakshmi-narayana'];
const BHAVAS = ['saumya', 'ugra', 'shringara', 'vira', 'dhyana'];

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type,authorization',
};

function response(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

// Mirrors times_daily/catalog.js — machine titles from auto-imports.
function isJunkTitle(t) {
  const s = String(t || '').trim();
  if (s.length < 4) return true;
  if (/^mj\s/i.test(s)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s)) return true;
  if (/\.(jpe?g|png|webp|avif)$/i.test(s)) return true;
  return false;
}

function uuidFromFileKey(fileKey) {
  return String(fileKey || '').replace(/^originals\//, '').replace(/\.[^./]+$/, '');
}

function needsOrganizing(item) {
  if (!item || !item.fileKey || item.archived || item.organizeSkipped) return false;
  if (item.mediaType === 'video' || item.mediaType === 'audio') return false;
  const noDeities = !Array.isArray(item.deities) || item.deities.length === 0;
  const noTags = !Array.isArray(item.tags) || item.tags.length === 0;
  if (item.aiSuggestion && !item.organizedAt) return true;
  // Auto-approved with medium/low confidence, or the AI disagreed with the iOS tag.
  if (item.needsCheck) return true;
  return isJunkTitle(item.title) || noDeities || noTags;
}

function orientationFromRatio(ratio) {
  const m = String(ratio || '').match(/^(\d+)\s*[:x]\s*(\d+)$/i);
  if (!m) return '';
  const w = Number(m[1]); const h = Number(m[2]);
  if (w === h) return 'square';
  return w > h ? 'landscape' : 'portrait';
}

let cachedApiKey = null;
async function anthropicKey() {
  if (cachedApiKey) return cachedApiKey;
  const out = await ssm.send(new GetParameterCommand({ Name: ANTHROPIC_KEY_PARAM, WithDecryption: true }));
  cachedApiKey = out.Parameter.Value;
  return cachedApiKey;
}

async function fetchImageBase64(item) {
  // Previews are 1200px JPEGs — ideal vision input. Fall back to the original.
  const keys = [`previews/${uuidFromFileKey(item.fileKey)}.jpg`, item.fileKey];
  for (const key of keys) {
    try {
      const out = await s3.send(new GetObjectCommand({ Bucket: ASSETS_BUCKET, Key: key }));
      const bytes = Buffer.from(await out.Body.transformToByteArray());
      if (bytes.length > MAX_IMAGE_BYTES) continue;
      const ext = key.split('.').pop().toLowerCase();
      const mediaType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return { data: bytes.toString('base64'), mediaType };
    } catch { /* try next key */ }
  }
  return null;
}

async function recentDecisions(limit = 15) {
  try {
    const out = await docClient.send(new QueryCommand({
      TableName: CATALOG_TABLE,
      IndexName: 'TypeIndex',
      KeyConditionExpression: '#type = :type',
      ExpressionAttributeNames: { '#type': 'type' },
      ExpressionAttributeValues: { ':type': DECISION_TYPE },
      Limit: limit,
      ScanIndexForward: false,
    }));
    return (out.Items || []).filter((d) => d.action === 'apply').map((d) => ({
      suggestedTitle: d.suggested && d.suggested.title,
      finalTitle: d.final && d.final.title,
      deities: d.final && d.final.deities,
      moodTag: d.final && d.final.moodTag,
      tags: d.final && d.final.tags,
    }));
  } catch (e) {
    console.warn('few-shot load failed:', e);
    return [];
  }
}

function systemPrompt(decisions) {
  return [
    'You organize Hindu spiritual AI-art wallpapers for akara.studio, a devotional broadsheet-style art site. You see each IMAGE plus its existing text. Suggest clean catalog metadata.',
    '',
    'Rules:',
    '- title: short and evocative in the Akara register (devotional, editorial), e.g. "Nataraja — The Cosmic Dance at Dusk". Max 60 chars. Never a filename or job id.',
    '- caption: one devotional line (max 140 chars) describing what is shown. If an existing caption is good, keep it verbatim.',
    `- deities: ONLY deities actually depicted. Canon: ${DEITY_CANON.join(', ')}. Empty array if uncertain — never guess.`,
    `- moodTag: exactly one of ${MOODS.join(', ')}.`,
    '- tags: 4-8 lowercase kebab-case tags (subject, style, setting, mood).',
    '- style: one short phrase for the art style (e.g. "traditional bronze", "ghibli", "miniature painting", "photoreal").',
    '- orientation: portrait | landscape | square, judged from the image.',
    '- Iconography: Shiva (third eye, crescent, trident, snake), Krishna (blue skin, flute, peacock feather), Ganesha (elephant head), Hanuman (vanara, gada), Devi/Durga/Kali (female, multi-armed, lion or tiger), Narasimha (lion-faced), Vishnu (blue, four arms, conch/chakra/mace/lotus), Rama (bow).',
    decisions.length
      ? `\nPAST ADMIN DECISIONS (strongest signal for naming taste):\n${JSON.stringify(decisions)}`
      : '',
    '',
    'Reply with ONLY a JSON object: {"title": str, "caption": str, "deities": [str], "moodTag": str, "tags": [str], "style": str, "orientation": str, "confidence": "high"|"medium"|"low", "reason": "<=12 words"}',
  ].join('\n');
}

function firstJsonObject(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function suggestOne(apiKey, system, item) {
  const context = [
    `current title: ${item.title || ''}`,
    `caption: ${(item.caption || '').slice(0, 200)}`,
    `shloka: ${(item.shloka || '').slice(0, 120)}`,
    `meaning: ${(item.meaning || '').slice(0, 160)}`,
    `style: ${item.style || ''}`,
    `ratio: ${item.ratio || ''}`,
  ].join('\n');

  const content = [{ type: 'text', text: context }];
  const img = await fetchImageBase64(item);
  if (img) {
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) {
    console.error('anthropic error', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const v = firstJsonObject(text);
  if (!v) return null;
  return {
    title: String(v.title || '').slice(0, 80),
    caption: String(v.caption || '').slice(0, 200),
    deities: Array.isArray(v.deities) ? v.deities.map(String).slice(0, 4) : [],
    moodTag: MOODS.includes(v.moodTag) ? v.moodTag : '',
    tags: Array.isArray(v.tags) ? v.tags.map((t) => String(t).toLowerCase()).slice(0, 8) : [],
    style: String(v.style || '').slice(0, 40),
    orientation: ['portrait', 'landscape', 'square'].includes(v.orientation)
      ? v.orientation : orientationFromRatio(item.ratio),
    confidence: ['high', 'medium', 'low'].includes(v.confidence) ? v.confidence : 'low',
    reason: String(v.reason || '').slice(0, 100),
    hadImage: Boolean(img),
  };
}

async function getQueue(event) {
  const qs = event.queryStringParameters || {};
  const limit = Math.min(Math.max(parseInt(qs.limit, 10) || 8, 1), 24);
  const deityFilter = String(qs.deity || '');

  // Collect every pending item, then order: junk "MJ ####" titles first,
  // newest first within each group.
  const pending = [];
  let lastKey;
  do {
    const out = await docClient.send(new QueryCommand({
      TableName: CATALOG_TABLE,
      IndexName: 'TypeIndex',
      KeyConditionExpression: '#type = :type',
      ExpressionAttributeNames: { '#type': 'type' },
      ExpressionAttributeValues: { ':type': 'wallpaper' },
      Limit: 100,
      ScanIndexForward: false,
      ExclusiveStartKey: lastKey,
    }));
    for (const item of out.Items || []) {
      if (!needsOrganizing(item)) continue;
      if (deityFilter) {
        const ds = (item.aiSuggestion && item.aiSuggestion.deities) || item.deities || [];
        if (!ds.includes(deityFilter)) continue;
      }
      pending.push(item);
    }
    lastKey = out.LastEvaluatedKey;
  } while (lastKey);
  pending.sort((a, b) => Number(isJunkTitle(b.title)) - Number(isJunkTitle(a.title)));
  const candidates = pending.slice(0, limit);
  const remaining = pending.length - candidates.length;

  const decisions = await recentDecisions();
  const system = systemPrompt(decisions);
  const apiKey = candidates.every((i) => i.aiSuggestion) ? null : await anthropicKey();

  const suggestions = await Promise.all(
    candidates.map((item) => (item.aiSuggestion
      ? Promise.resolve({ ...item.aiSuggestion, hadImage: true, precomputed: true })
      : suggestOne(apiKey, system, item)).catch((e) => {
      console.error('suggest failed for', item.pk, e);
      return null;
    })),
  );

  const cards = candidates.map((item, i) => ({
    id: item.pk.split('#')[1],
    version: (item.sk || 'v#1').split('#')[1],
    title: item.title,
    caption: item.caption,
    shloka: item.shloka,
    meaning: item.meaning,
    style: item.style,
    ratio: item.ratio,
    fileKey: item.fileKey,
    deities: item.deities || [],
    form: item.form || '',
    couple: item.couple || '',
    bhava: item.bhava || '',
    moodTag: item.moodTag || '',
    tags: item.tags || [],
    freePreview: Boolean(item.freePreview),
    createdAt: item.createdAt,
    previewUrl: `${SITE_URL}/content/previews/${uuidFromFileKey(item.fileKey)}.jpg`,
    suggestion: suggestions[i],
  }));

  return response(200, {
    ok: true,
    cards,
    pendingTotal: candidates.length + remaining,
    fewShotCount: decisions.length,
    model: MODEL,
  });
}

const EDITABLE = ['title', 'caption', 'deities', 'moodTag', 'tags', 'style', 'orientation', 'form', 'couple', 'bhava', 'heroFor'];

async function postDecision(event) {
  const body = JSON.parse(event.body || '{}');
  const { id, version = '1', action, fields = {}, suggested = null } = body;
  if (!id || !['apply', 'skip'].includes(action)) {
    return response(400, { ok: false, error: 'Required: id, action ("apply" | "skip")' });
  }
  const key = { pk: `WALLPAPER#${id}`, sk: `v#${version}` };

  const existing = await docClient.send(new GetCommand({ TableName: CATALOG_TABLE, Key: key }));
  if (!existing.Item) return response(404, { ok: false, error: 'Catalog item not found' });

  const now = new Date().toISOString();

  if (action === 'skip') {
    await docClient.send(new UpdateCommand({
      TableName: CATALOG_TABLE,
      Key: key,
      UpdateExpression: 'SET organizeSkipped = :t, needsCheck = :f, updatedAt = :now',
      ExpressionAttributeValues: { ':t': true, ':f': false, ':now': now },
    }));
  } else {
    const names = { '#updatedAt': 'updatedAt', '#organizedAt': 'organizedAt' };
    const values = { ':updatedAt': now, ':organizedAt': now };
    const sets = ['#updatedAt = :updatedAt', '#organizedAt = :organizedAt', '#needsCheck = :nc'];
    names['#needsCheck'] = 'needsCheck'; values[':nc'] = false;
    if ('couple' in fields && !COUPLES.includes(fields.couple)) fields.couple = '';
    if ('bhava' in fields && !BHAVAS.includes(fields.bhava)) fields.bhava = '';
    for (const f of EDITABLE) {
      if (!Object.prototype.hasOwnProperty.call(fields, f)) continue;
      names[`#${f}`] = f;
      values[`:${f}`] = fields[f];
      sets.push(`#${f} = :${f}`);
    }
    if (sets.length === 3) return response(400, { ok: false, error: 'No editable fields provided' });
    await docClient.send(new UpdateCommand({
      TableName: CATALOG_TABLE,
      Key: key,
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));
  }

  // Decision log doubles as the few-shot corpus for the next queue load.
  await docClient.send(new PutCommand({
    TableName: CATALOG_TABLE,
    Item: {
      pk: `ORGDEC#${randomUUID()}`,
      sk: 'v#1',
      type: DECISION_TYPE,
      itemId: id,
      action,
      previousTitle: existing.Item.title || '',
      suggested,
      final: action === 'apply' ? fields : null,
      createdAt: now,
    },
  }));

  return response(200, { ok: true, action, id });
}

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
  const method = event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };
  try {
    if (method === 'GET') return await getQueue(event);
    if (method === 'POST') return await postDecision(event);
    return response(405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Error:', err);
    return response(500, { ok: false, error: 'Internal server error' });
  }
};

let _extraDeitiesAt = 0;
async function loadExtraDeities() {
  if (Date.now() - _extraDeitiesAt < 10 * 60 * 1000) return;
  try {
    const r = await fetch('https://www.akara.studio/content/darshan/deities.json');
    if (r.ok) for (const d of ((await r.json()).deities || [])) if (d && d.name && !DEITY_CANON.includes(d.name)) DEITY_CANON.push(d.name);
    _extraDeitiesAt = Date.now();
  } catch (e) { console.warn('deity registry read failed', e && e.message); }
}

exports.handler = async (event) => {
  await loadExtraDeities();
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
