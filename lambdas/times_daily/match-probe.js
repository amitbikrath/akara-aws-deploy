// Read-only probe: scan the live catalog and show which image the matcher picks
// for each deity. No Anthropic, no writes.
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const catalog = require('./catalog');
const { DEITIES } = require('./topics');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

(async () => {
  const items = await catalog.fetchWallpapers(ddb, 'akara-catalog');
  console.log(`scanned ${items.length} wallpapers\n`);
  for (const key of Object.keys(DEITIES)) {
    const r = catalog.pickImage(items, { deity: key, terms: DEITIES[key].epithets });
    const t = r ? (r.item.title || '(untitled)') : '(none)';
    console.log(`${key.padEnd(10)} score=${String(r ? r.score : '-').padEnd(3)} → ${t}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
