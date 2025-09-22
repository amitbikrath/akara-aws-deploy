// get_upload_url Lambda (Node 20) - returns a presigned S3 PUT URL
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";

const s3 = new S3Client({});

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,PUT,OPTIONS",
  "access-control-allow-headers": "authorization,content-type"
};

const allowCors = (body, statusCode = 200) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    ...cors
  },
  body: JSON.stringify(body)
});

export const handler = async (event) => {
  // Handle OPTIONS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }

  // Accept GET with queryStringParameters (no body) to avoid "GET cannot have body" errors
  const qs = event?.queryStringParameters || {};
  const filename = (qs.filename || "").toString().trim();
  const contentType = (qs.contentType || "application/octet-stream").toString();

  const bucket = process.env.ASSETS_BUCKET;
  if (!bucket) return allowCors({ ok: false, error: "Missing ASSETS_BUCKET" }, 500);
  if (!filename) return allowCors({ ok: false, error: "filename required" }, 400);

  // Put uploads under /content/
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `content/${uuid()}-${safeName}`;

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType
  });

  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 }); // 15m

  return allowCors({ ok: true, uploadUrl, key, bucket, contentType });
};