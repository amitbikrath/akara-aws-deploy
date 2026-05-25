const crypto = require('crypto');

const CONSUMER_SECRET = process.env.X_CONSUMER_SECRET;
const TARGET_USER_ID = process.env.X_TARGET_USER_ID;

function crcResponse(crcToken) {
  const hmac = crypto
    .createHmac('sha256', CONSUMER_SECRET)
    .update(crcToken)
    .digest('base64');
  return { response_token: `sha256=${hmac}` };
}

function verifySignature(bodyBuf, header) {
  if (!header) return false;
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', CONSUMER_SECRET).update(bodyBuf).digest('base64');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// X's account-activity firehose delivers everything for the subscribed user
// (mentions, DMs, likes received, retweets, etc.). Filter down to original
// posts authored by TARGET_USER_ID — no retweets, replies, or quote tweets.
function isOriginalPostByTarget(tweet) {
  if (tweet.user?.id_str !== TARGET_USER_ID) return false;
  if (tweet.retweeted_status) return false;
  if (tweet.in_reply_to_status_id_str) return false;
  if (tweet.is_quote_status) return false;
  return true;
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod;

  if (method === 'GET') {
    const crcToken = event.queryStringParameters?.crc_token;
    if (!crcToken) {
      return { statusCode: 400, body: 'missing crc_token' };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crcResponse(crcToken)),
    };
  }

  if (method === 'POST') {
    const rawBodyBuf = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64')
      : Buffer.from(event.body || '', 'utf8');

    const sigHeader =
      event.headers?.['x-twitter-webhooks-signature'] ||
      event.headers?.['X-Twitter-Webhooks-Signature'];

    if (!verifySignature(rawBodyBuf, sigHeader)) {
      console.warn('Invalid signature on webhook POST');
      return { statusCode: 401, body: 'invalid signature' };
    }

    let payload;
    try {
      payload = JSON.parse(rawBodyBuf.toString('utf8'));
    } catch (err) {
      console.error('Bad JSON body:', err);
      return { statusCode: 400, body: 'bad json' };
    }

    const tweets = payload.tweet_create_events || [];
    const myPosts = tweets.filter(isOriginalPostByTarget);

    for (const t of myPosts) {
      console.log(
        JSON.stringify({
          event: 'original_post',
          tweet_id: t.id_str,
          text: t.full_text || t.text,
          created_at: t.created_at,
          url: `https://x.com/i/web/status/${t.id_str}`,
        })
      );
    }

    return { statusCode: 200, body: 'ok' };
  }

  return { statusCode: 405, body: 'method not allowed' };
};
