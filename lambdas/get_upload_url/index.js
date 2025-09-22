// Generate a presigned PUT URL for S3 upload
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const BUCKET = process.env.ASSETS_BUCKET;

const s3 = new S3Client({ region: REGION });

exports.handler = async (event) => {
  try {
    const qs = event?.queryStringParameters || {};
    const key = qs.key || `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.bin`;
    const contentType = qs.contentType || 'application/octet-stream';

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 900 }); // 15 min
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ok: true, bucket: BUCKET, key, url, contentType }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ok: false, error: String(err) }),
    };
  }
};