// Editorial Desk — the one place the Akara Lambdas turn a source item into a
// newspaper article and put it on the wire.
//
// Interface (see CONTEXT.md "Editorial Desk"):
//   const desk = createDesk({ region, apiKey, apiKeyParam, distributionId, clients })
//   desk.getParam(name, { fallback, decrypt })  -> string | fallback
//   desk.putParam(name, value)
//   desk.writeArticle({ model, system, user, schema, maxTokens, webSearch }) -> { article, usage }
//   desk.publish({ bucket, key, body, contentType, cacheControl })
//   desk.invalidate(paths)
//
// Rules: it THROWS on every failure — callers pick their own fallback. It holds
// no per-source defaults: model, prompt, schema and max tokens come from the
// caller. `clients` lets tests pass fakes for { ssm, s3, cloudfront, anthropic }.
//
// Source of truth is layers/editorial-desk/src/. package-desk.sh copies it into
// nodejs/node_modules/@akara/editorial-desk AFTER npm install (npm prunes
// undeclared packages, so it must not live there permanently).

function lazy(make) {
  let v;
  return () => (v === undefined ? (v = make()) : v);
}

function extractJson(text) {
  if (!text) throw new Error('empty model output');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in model output');
  return JSON.parse(text.slice(start, end + 1));
}

function normaliseUsage(u = {}) {
  return {
    input_tokens: u.input_tokens || 0,
    output_tokens: u.output_tokens || 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens || 0,
    cache_read_input_tokens: u.cache_read_input_tokens || 0,
  };
}

// When a fake client is injected the real command classes are not needed —
// commands become plain { name, input } records the fake can inspect.
const fakeCmds = new Proxy({}, {
  get: (_, name) => function FakeCommand(input) { this.name = name; this.input = input; },
});

function createDesk(opts = {}) {
  const region = opts.region || process.env.AWS_REGION || 'us-east-1';
  const clients = opts.clients || {};
  const log = opts.log || console;

  const ssm = lazy(() => {
    if (clients.ssm) return clients.ssm;
    const { SSMClient } = require('@aws-sdk/client-ssm');
    return new SSMClient({ region });
  });
  const s3 = lazy(() => {
    if (clients.s3) return clients.s3;
    const { S3Client } = require('@aws-sdk/client-s3');
    return new S3Client({ region });
  });
  const cloudfront = lazy(() => {
    if (clients.cloudfront) return clients.cloudfront;
    const { CloudFrontClient } = require('@aws-sdk/client-cloudfront');
    return new CloudFrontClient({ region: 'us-east-1' });
  });

  async function getParam(name, { fallback = null, decrypt = false } = {}) {
    if (!name) return fallback;
    const { GetParameterCommand } = clients.ssm ? fakeCmds : require('@aws-sdk/client-ssm');
    try {
      const r = await ssm().send(new GetParameterCommand({ Name: name, WithDecryption: decrypt }));
      return r.Parameter?.Value ?? fallback;
    } catch (e) {
      if (e.name === 'ParameterNotFound') return fallback;
      throw e;
    }
  }

  async function putParam(name, value) {
    const { PutParameterCommand } = clients.ssm ? fakeCmds : require('@aws-sdk/client-ssm');
    await ssm().send(new PutParameterCommand({ Name: name, Value: value, Type: 'String', Overwrite: true }));
  }

  let anthropicPromise = null;
  function anthropic() {
    if (!anthropicPromise) {
      anthropicPromise = (async () => {
        if (clients.anthropic) return clients.anthropic;
        let key = opts.apiKey || process.env.ANTHROPIC_API_KEY || null;
        if (!key && opts.apiKeyParam) key = await getParam(opts.apiKeyParam, { decrypt: true });
        if (!key) throw new Error('Editorial Desk: no Anthropic key (set apiKey, ANTHROPIC_API_KEY, or apiKeyParam)');
        const { Anthropic } = require('@anthropic-ai/sdk');
        return new Anthropic({ apiKey: key });
      })();
    }
    return anthropicPromise;
  }

  // Ask Claude for one article. `schema` (JSON schema) turns on structured
  // output; `webSearch` gives the model the web_search tool instead (the two
  // cannot combine today). Either path retries once as a plain call if the
  // feature is rejected by the API.
  async function writeArticle({ model, system, user, schema = null, maxTokens, webSearch = false }) {
    if (!model) throw new Error('writeArticle: model is required');
    if (!system) throw new Error('writeArticle: system prompt is required');
    if (!user) throw new Error('writeArticle: user turn is required');
    if (!maxTokens) throw new Error('writeArticle: maxTokens is required');
    const client = await anthropic();

    const base = {
      model,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    };
    const extra = webSearch
      ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] }
      : schema
        ? { output_config: { format: { type: 'json_schema', schema } } }
        : {};

    let response;
    try {
      response = await client.messages.create({ ...base, ...extra });
    } catch (e) {
      if (!Object.keys(extra).length) throw e;
      log.warn(`Editorial Desk: ${webSearch ? 'web_search' : 'structured output'} rejected, retrying plain: ${e.message}`);
      response = await client.messages.create(base);
    }

    const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return { article: extractJson(text), usage: normaliseUsage(response.usage) };
  }

  async function publish({ bucket, key, body, contentType, cacheControl }) {
    if (!bucket || !key) throw new Error('publish: bucket and key are required');
    const { PutObjectCommand } = clients.s3 ? fakeCmds : require('@aws-sdk/client-s3');
    await s3().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }));
  }

  async function invalidate(paths, { callerReference } = {}) {
    if (!opts.distributionId) {
      log.warn('Editorial Desk: no distributionId — skipping CloudFront invalidation');
      return false;
    }
    if (!paths || !paths.length) return false;
    const { CreateInvalidationCommand } = clients.cloudfront ? fakeCmds : require('@aws-sdk/client-cloudfront');
    await cloudfront().send(new CreateInvalidationCommand({
      DistributionId: opts.distributionId,
      InvalidationBatch: {
        CallerReference: callerReference || `desk-${Date.now()}`,
        Paths: { Quantity: paths.length, Items: paths },
      },
    }));
    return true;
  }

  return { getParam, putParam, writeArticle, publish, invalidate };
}

module.exports = { createDesk, extractJson };
