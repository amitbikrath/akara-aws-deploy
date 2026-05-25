// catalog.js — match an article topic to the best image in the wallpaper
// corpus. The live catalog does NOT populate deity/tags (verified: 0/274), but
// every item has a rich `title` + `caption` (+ shloka/meaning). So we score on
// text. Pure scoring is separated from the DynamoDB fetch so it unit-tests
// without AWS.

const SITE = 'https://www.akara.studio';

function normalize(s) {
  return String(s || '').toLowerCase();
}

function itemText(item) {
  return normalize([item.title, item.caption, item.meaning, item.shloka].filter(Boolean).join('  '));
}

// Auto-imported originals often have machine titles ("MJ 1b4d65", a UUID, or a
// bare filename). Usable if their caption matches, but never the preferred pick.
function isJunkTitle(t) {
  const s = String(t || '').trim();
  if (s.length < 4) return true;
  if (/^mj\s/i.test(s)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s)) return true;
  if (/\.(jpe?g|png|webp|avif)$/i.test(s)) return true;
  return false;
}

// Word-PREFIX match (not naive substring): a term matches a word that starts
// with it, so "ram" hits "Rama"/"Ramayana" and "krishn" hits "Krishna", but
// "sun" no longer hits "sunset". Substring matching produced exactly that false
// positive (a Rama "Sunset" image scoring for a Surya article).
function termRegex(t) {
  return new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}
function scoreItem(item, query) {
  const title = normalize(item.title);
  const text = itemText(item);
  let score = 0;
  const terms = (query && query.terms) || [];
  for (const raw of terms) {
    const t = normalize(raw).trim();
    if (t.length < 3) continue;
    const re = termRegex(t);
    if (re.test(title)) score += 5;
    else if (re.test(text)) score += 2;
  }
  if (isJunkTitle(item.title)) score -= 1;
  return score;
}

// pickImage — highest scorer, but only if SOMETHING matched. A zero score
// means no relevant art in the corpus (e.g. no Surya images); we return null
// rather than attach a contradictory image (a Shiva piece on a Surya article).
function pickImage(items, query) {
  const usable = (items || []).filter((it) => it && it.fileKey && !it.archived && !it.hiddenFromPublic);
  let best = null;
  let bestScore = 0;
  for (const it of usable) {
    const s = scoreItem(it, query);
    if (s > bestScore) {
      bestScore = s;
      best = it;
    }
  }
  return best && bestScore > 0 ? { item: best, score: bestScore } : null;
}

function uuidFromFileKey(fileKey) {
  return String(fileKey || '').replace(/^originals\//, '').replace(/\.[^./]+$/, '');
}

// Public preview URL (watermarked unless the item is freePreview) served via
// CloudFront at /content/previews/{uuid}.jpg.
function previewUrl(fileKey, base = SITE) {
  return `${base}/content/previews/${uuidFromFileKey(fileKey)}.jpg`;
}

function parseRatio(ratio) {
  const m = String(ratio || '').match(/^(\d+)\s*[:x]\s*(\d+)$/i);
  if (!m) return { width: 1200, height: 1500 };
  return { width: Number(m[1]), height: Number(m[2]) };
}

function cleanAlt(title, deityDisplay) {
  if (title && !isJunkTitle(title)) return title;
  return deityDisplay ? `${deityDisplay} — Akara devotional art` : 'Akara devotional art';
}

// buildImage — the image object attached to an article + used for OG/JSON-LD.
function buildImage(item, deityDisplay, base = SITE) {
  if (!item) return null;
  const { width, height } = parseRatio(item.ratio);
  return {
    wallpaperId: item.id || null,
    url: previewUrl(item.fileKey, base),
    alt: cleanAlt(item.title, deityDisplay),
    title: isJunkTitle(item.title) ? null : item.title || null,
    shloka: item.shloka || '',
    meaning: item.meaning || '',
    width,
    height,
  };
}

// fetchWallpapers — runtime DynamoDB read (GSI TypeIndex, type='wallpaper').
// docClient is injected so this file has no hard AWS dependency for tests.
async function fetchWallpapers(docClient, table) {
  const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await docClient.send(
      new QueryCommand({
        TableName: table,
        IndexName: 'TypeIndex',
        KeyConditionExpression: '#t = :w',
        ExpressionAttributeNames: { '#t': 'type' },
        ExpressionAttributeValues: { ':w': 'wallpaper' },
        ProjectionExpression: 'id, title, caption, meaning, shloka, fileKey, ratio, archived, hiddenFromPublic',
        ExclusiveStartKey,
      })
    );
    for (const it of res.Items || []) items.push(it);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

module.exports = {
  SITE,
  scoreItem,
  pickImage,
  buildImage,
  previewUrl,
  uuidFromFileKey,
  parseRatio,
  isJunkTitle,
  fetchWallpapers,
};
