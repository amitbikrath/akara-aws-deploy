// grantImageAccess Lambda
//
// Route:   POST /api/grant-image-access  (JWT-authorised by API Gateway)
// Effect:  Returns three Set-Cookie headers (CloudFront-Policy / -Signature /
//          -Key-Pair-Id) scoped to /content/originals/* on the same origin.
//          Browser then sends those cookies on subsequent image requests,
//          and CloudFront verifies the signature against the configured
//          public key group before letting the request through to S3.
//
// Env:
//   CF_KEY_PAIR_ID         — CloudFront public key ID (Kxxxxxxx)
//   CF_PRIVATE_KEY_PARAM   — SSM parameter name holding RSA private key (PEM)
//   COOKIE_DOMAIN          — host the cookies should be scoped to (e.g. www.akara.studio)
//   COOKIE_PATH            — usually /content/originals
//   ACCESS_RESOURCE        — full URL pattern (e.g. https://www.akara.studio/content/originals/*)
//   TTL_SECONDS            — default 3600

const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const crypto = require("crypto");

const ssm = new SSMClient({ region: process.env.AWS_REGION });

// Cache the private key across warm invocations.
let _privateKey = null;
async function getPrivateKey() {
  if (_privateKey) return _privateKey;
  const out = await ssm.send(new GetParameterCommand({
    Name: process.env.CF_PRIVATE_KEY_PARAM,
    WithDecryption: true,
  }));
  _privateKey = out.Parameter.Value;
  return _privateKey;
}

// CloudFront uses URL-safe base64 with non-standard substitutions.
function cfBase64(buf) {
  return Buffer.from(buf).toString("base64")
    .replace(/\+/g, "-").replace(/=/g, "_").replace(/\//g, "~");
}

function buildPolicy(resource, expiresAtEpoch) {
  return JSON.stringify({
    Statement: [{
      Resource: resource,
      Condition: { DateLessThan: { "AWS:EpochTime": expiresAtEpoch } },
    }],
  });
}

function signPolicy(policyStr, privateKeyPem) {
  const signer = crypto.createSign("RSA-SHA1");
  signer.update(policyStr);
  return signer.sign(privateKeyPem);
}

function buildCookies({ policy, signature, keyPairId, domain, path, maxAge }) {
  const attrs = (extraAttrs = "") =>
    `Domain=${domain}; Path=${path}; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${extraAttrs}`;
  return [
    `CloudFront-Policy=${cfBase64(policy)}; ${attrs()}`,
    `CloudFront-Signature=${cfBase64(signature)}; ${attrs()}`,
    `CloudFront-Key-Pair-Id=${keyPairId}; ${attrs()}`,
  ];
}

// CORS headers for browser fetch from same registrable domain. We ALWAYS
// allow only the configured cookie domain — never "*" (which would be
// rejected with credentials anyway).
function corsHeaders(originHeader) {
  const allowed = new Set([
    `https://${process.env.COOKIE_DOMAIN}`,
    "https://akara.studio",
    "https://www.akara.studio",
    "http://localhost:3000",
  ]);
  const allow = allowed.has(originHeader) ? originHeader : `https://${process.env.COOKIE_DOMAIN}`;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || "";
  const headers = corsHeaders(origin);
  const method = event.requestContext?.http?.method || "POST";

  if (method === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Sub action: revoke (sign-out). Returns expired cookies so the browser drops them.
  let action = "grant";
  try {
    const body = JSON.parse(event.body || "{}");
    if (body && body.action === "revoke") action = "revoke";
  } catch {}

  const ttl    = parseInt(process.env.TTL_SECONDS || "3600", 10);
  const domain = process.env.COOKIE_DOMAIN;
  const path   = process.env.COOKIE_PATH || "/content/originals";

  if (action === "revoke") {
    // Empty value + Max-Age=0 deletes the cookie in the browser.
    const expired = ["CloudFront-Policy", "CloudFront-Signature", "CloudFront-Key-Pair-Id"]
      .map((n) => `${n}=; Domain=${domain}; Path=${path}; Secure; HttpOnly; SameSite=Lax; Max-Age=0`);
    return {
      statusCode: 200,
      headers,
      cookies: expired,
      body: JSON.stringify({ ok: true, action: "revoke" }),
    };
  }

  try {
    const privateKey = await getPrivateKey();
    const expires = Math.floor(Date.now() / 1000) + ttl;
    const policy = buildPolicy(process.env.ACCESS_RESOURCE, expires);
    const signature = signPolicy(policy, privateKey);
    const cookies = buildCookies({
      policy, signature,
      keyPairId: process.env.CF_KEY_PAIR_ID,
      domain, path, maxAge: ttl,
    });

    // API Gateway HTTP API (v2) supports a top-level `cookies` array.
    return {
      statusCode: 200,
      headers,
      cookies,
      body: JSON.stringify({ ok: true, expiresAt: expires }),
    };
  } catch (e) {
    console.error("grant-image-access error:", e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: (e && e.message) || "internal" }),
    };
  }
};
