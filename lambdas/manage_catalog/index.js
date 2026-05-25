const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
const cfClient = new CloudFrontClient({ region: 'us-east-1' });

// Map originals/{uuid}.{ext} → previews/{uuid}.jpg (mirrors generatePreview).
function previewKeyFor(originalKey) {
  const base = String(originalKey).replace(/^originals\//, '').replace(/\.[^./]+$/, '');
  return `previews/${base}.jpg`;
}

// Fire-and-forget regenerate of one wallpaper's preview at the requested tier.
// `free=true` produces a full-resolution unwatermarked JPEG; false produces
// the standard 1200px watermarked preview. Used when admin toggles
// freePreview so the visible image flips within ~3-5 seconds.
async function regeneratePreview(fileKey, free) {
  if (!process.env.PREVIEW_FN || !fileKey) return;
  try {
    await lambdaClient.send(new InvokeCommand({
      FunctionName: process.env.PREVIEW_FN,
      InvocationType: 'Event',                  // async; we don't wait
      Payload: Buffer.from(JSON.stringify({ keys: [fileKey], free: !!free })),
    }));
  } catch (e) {
    console.error('preview regen invoke failed:', e);
  }
}

// Punch a hole in the CloudFront edge cache for the specific preview file
// after we ask the preview Lambda to overwrite it. Without this, viewers see
// the OLD watermarked/locked version for up to a year (Cache-Control:
// immutable), which is exactly the bug the freePreview toggle had today.
async function invalidatePreviewPath(fileKey) {
  if (!process.env.FRONTEND_DISTRIBUTION_ID || !fileKey) return;
  const path = '/content/' + previewKeyFor(fileKey);
  try {
    await cfClient.send(new CreateInvalidationCommand({
      DistributionId: process.env.FRONTEND_DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: `freepreview-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        Paths: { Quantity: 1, Items: [path] },
      },
    }));
    console.log('cloudfront invalidation issued for', path);
  } catch (e) {
    console.error('cloudfront invalidation failed:', e);
  }
}

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

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { action, type, id, version = '1' } = body;

    if (!action || !type || !id) {
      return response(400, { error: 'Missing required fields: action, type, id' });
    }

    if (!['wallpaper', 'music', 'site'].includes(type)) {
      return response(400, { error: 'Type must be "wallpaper", "music", or "site"' });
    }

    if (!['archive', 'unarchive', 'delete', 'update'].includes(action)) {
      return response(400, { error: 'Action must be "archive", "unarchive", "update", or "delete"' });
    }

    const key = {
      pk: `${type.toUpperCase()}#${id}`,
      sk: `v#${version}`
    };

    if (action === 'delete') {
      await docClient.send(new DeleteCommand({
        TableName: process.env.CATALOG_TABLE,
        Key: key
      }));

      return response(200, { ok: true, message: 'Deleted successfully', action, id, version });
    }

    if (action === 'update') {
      const now = new Date().toISOString();
      const editableFields = [
        'title',
        'caption',
        'shloka',
        'meaning',
        'style',
        'ratio',
        'palette',
        'fileKey',
        'thumbKey',
        'mediaType',
        'mimeType',
        'lyrics',
        'albumArtKey',
        'body',
        'contactEmail',
        'contactPhone',
        'contactAddress',
        'contactInstagram',
        'storyImageKey',
        'storyImageFocusX',
        'storyImageFocusY',
        // Phase 3 freemium: when true the public preview is the full-res
        // unwatermarked JPEG (free teaser). When false it's the standard
        // 1200px watermarked one. Toggling this triggers preview regen.
        'freePreview',
        'hiddenFromPublic'
      ];
      const provided = editableFields.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
      if (provided.length === 0) {
        return response(400, { error: 'No editable fields provided for update' });
      }

      const expressionNames = { '#updatedAt': 'updatedAt' };
      const expressionValues = { ':updatedAt': now };
      const setClauses = ['#updatedAt = :updatedAt'];

      for (const field of provided) {
        let val = body[field];
        if (
          field === 'body' &&
          typeof val === 'string' &&
          body.title === WALL_DISPLAY_SETTINGS_TITLE
        ) {
          val = normalizeWallDisplayBodyString(val);
        }
        expressionNames[`#${field}`] = field;
        expressionValues[`:${field}`] = val;
        setClauses.push(`#${field} = :${field}`);
      }

      await docClient.send(new UpdateCommand({
        TableName: process.env.CATALOG_TABLE,
        Key: key,
        UpdateExpression: `SET ${setClauses.join(', ')}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues
      }));

      // If freePreview was toggled on a wallpaper, kick off a background
      // preview regeneration so the public asset matches the new tier.
      if (type === 'wallpaper' && Object.prototype.hasOwnProperty.call(body, 'freePreview')) {
        // Look up the item so we have its current fileKey (caller may not include it).
        let fileKey = body.fileKey;
        if (!fileKey) {
          try {
            const got = await docClient.send(new GetCommand({
              TableName: process.env.CATALOG_TABLE,
              Key: key,
            }));
            fileKey = got.Item && got.Item.fileKey;
          } catch (e) { console.error('lookup for regen failed:', e); }
        }
        if (fileKey) {
          await regeneratePreview(fileKey, body.freePreview === true);
          // Invalidate after a small delay so the new preview has a moment
          // to land in S3. Even if the timing is off, CloudFront will pick
          // up the new file the next time it has a cache miss for this
          // path, so the worst case is a ~5-10 second delay.
          await new Promise((r) => setTimeout(r, 4000));
          await invalidatePreviewPath(fileKey);
        }
      }

      return response(200, {
        ok: true,
        message: 'Updated successfully',
        action,
        id,
        version
      });
    }

    const archived = action === 'archive';
    const now = new Date().toISOString();
    await docClient.send(new UpdateCommand({
      TableName: process.env.CATALOG_TABLE,
      Key: key,
      UpdateExpression: 'SET archived = :archived, archivedAt = :archivedAt',
      ExpressionAttributeValues: {
        ':archived': archived,
        ':archivedAt': archived ? now : null
      }
    }));

    return response(200, {
      ok: true,
      message: archived ? 'Archived successfully' : 'Unarchived successfully',
      action,
      id,
      version,
      archived
    });
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error' });
  }
};
