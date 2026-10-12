// darshan_snapshot — writes one small, cacheable catalog file for the Darśana
// page (akara/darshan/catalog.json on the frontend bucket). Replaces 7 chained
// /api/catalog calls (~10 s, 900 KB) with one edge-cached file. Runs right after
// darshan_enrich tags a new post, and every 10 minutes (EventBridge) for admin
// Organize edits. When the content changed it clears the CloudFront copy, so a
// new post is live in ~1-2 min; unchanged runs cost no invalidation.
// Since 2026-10-11 it also gives each work its link and its own page — see pages.js.
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const { createHash } = require('crypto');
const pages = require('./pages');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const TABLE = process.env.CATALOG_TABLE || 'akara-catalog';
const BUCKET = process.env.FRONTEND_BUCKET;
const KEY = process.env.SNAPSHOT_KEY || 'akara/darshan/catalog.json';
const DISTRIBUTION = process.env.CLOUDFRONT_DISTRIBUTION_ID || 'EBWBTLYBASPTD';
const cf = new CloudFrontClient({});

exports.handler = async () => {
  const items = [];
  let ExclusiveStartKey;
  do {
    const out = await ddb.send(new QueryCommand({
      TableName: TABLE, IndexName: 'TypeIndex', KeyConditionExpression: '#t = :w',
      ExpressionAttributeNames: { '#t': 'type' }, ExpressionAttributeValues: { ':w': 'wallpaper' },
      ScanIndexForward: false, ExclusiveStartKey,
    }));
    items.push(...(out.Items || []));
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  // A lone strip (one piece of a cut, no slideKeys) stays hidden; a full
  // multi-image post is shown whatever its old title said.
  const isPublic = (i) => !i.hiddenFromPublic && !i.archived && (i.mediaType || 'image') === 'image' && i.fileKey
    && ((i.slideKeys || []).length || (!/ · strip /.test(i.title || '') && !/ · strip /.test(i.previousTitle || '')));
  let slugs = 0;
  try { slugs = await pages.assignSlugs(ddb, TABLE, items.filter(isPublic)); } catch (e) { console.warn('slugs failed:', e); }

  const slim = items
    .filter((i) => !i.hiddenFromPublic && !i.archived && (i.mediaType || 'image') === 'image' && i.fileKey
    && ((i.slideKeys || []).length || (!/ · strip /.test(i.title || '') && !/ · strip /.test(i.previousTitle || ''))))
    .map((i) => {
      const a = i.aiSuggestion;
      const o = {
        id: i.pk.split('#')[1], fileKey: i.fileKey, title: i.title || '', ratio: i.ratio || '',
        deities: i.deities || [], couple: i.couple || '', bhava: i.bhava || '', form: i.form || '',
        organizedAt: i.organizedAt || null, caption: i.organizedAt ? (i.caption || '') : '',
        colors: (i.colors || []).slice(0, 5).map((c) => ({ hex: c.hex, pct: Number(c.pct) })),
        accentColor: i.accentColor || '', heroFor: i.heroFor || [], freePreview: Boolean(i.freePreview),
        stories: i.stories || [], autoApprovedConfidence: i.autoApprovedConfidence || '',
        layout: i.layout || '', slideKeys: i.slideKeys || [], slug: i.slug || '',
      };
      // Unapproved AI tags ride along for the staging preview (?preview=1) only.
      if (a && !i.organizedAt) o.aiPreview = { title: a.title, deities: a.deities, couple: a.couple, bhava: a.bhava, confidence: a.confidence };
      return o;
    });

  const sha = createHash('sha256').update(JSON.stringify(slim)).digest('hex').slice(0, 32);
  let prev = '';
  try { prev = ((await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: KEY }))).Metadata || {})['items-sha'] || ''; } catch (e) { /* first run */ }
  // Work pages run every time: they also change when the gallery page itself is redeployed.
  let pg = null;
  try { pg = await pages.writePages(s3, BUCKET, slim); } catch (e) { console.warn('work pages failed:', e); }
  if (pg && pg.written) {
    try {
      await cf.send(new CreateInvalidationCommand({ DistributionId: DISTRIBUTION, InvalidationBatch: {
        CallerReference: `darshan-art-${Date.now()}`, Paths: { Quantity: 2, Items: ['/darshan/art/*', '/sitemap-darshan.xml'] } } }));
    } catch (e) { console.warn('page invalidation failed (edge copies expire in 5 min):', e.name || e); }
  }
  if (prev === sha) return { ok: true, count: slim.length, changed: false, slugs, pages: pg };

  const body = JSON.stringify({ generatedAt: new Date().toISOString(), items: slim });
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: KEY, Body: body, ContentType: 'application/json',
    CacheControl: 'public, max-age=60, stale-while-revalidate=60', Metadata: { 'items-sha': sha },
  }));
  try {
    await cf.send(new CreateInvalidationCommand({ DistributionId: DISTRIBUTION, InvalidationBatch: {
      CallerReference: `darshan-${sha}-${Date.now()}`, Paths: { Quantity: 1, Items: [`/${KEY}`] } } }));
  } catch (e) { console.warn('invalidation failed (edge copy expires in 60 s):', e.name || e); }
  return { ok: true, count: slim.length, bytes: body.length, changed: true, slugs, pages: pg };
};
