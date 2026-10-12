const test = require('node:test');
const assert = require('node:assert/strict');
const { createDesk, extractJson } = require('../src');

function fakeAnthropic(responses) {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (req) => {
        calls.push(req);
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
      },
    },
  };
}
const textResp = (text, usage = { input_tokens: 10, output_tokens: 5 }) => ({ content: [{ type: 'text', text }], usage });
function fakeSend() {
  const sent = [];
  return { sent, send: async (cmd) => { sent.push(cmd); return { Parameter: { Value: 'v' } }; } };
}

test('extractJson finds the object inside prose', () => {
  assert.deepEqual(extractJson('here you go {"a":1} thanks'), { a: 1 });
  assert.throws(() => extractJson(''), /empty/);
  assert.throws(() => extractJson('no json'), /no JSON/);
});

test('writeArticle sends cached system, schema, and returns parsed article + usage', async () => {
  const an = fakeAnthropic([textResp('{"headline":"H","body":"B"}', { input_tokens: 3, output_tokens: 4, cache_read_input_tokens: 2 })]);
  const desk = createDesk({ clients: { anthropic: an } });
  const out = await desk.writeArticle({ model: 'm', system: 'S', user: 'U', schema: { type: 'object' }, maxTokens: 100 });
  assert.deepEqual(out.article, { headline: 'H', body: 'B' });
  assert.deepEqual(out.usage, { input_tokens: 3, output_tokens: 4, cache_creation_input_tokens: 0, cache_read_input_tokens: 2 });
  const req = an.calls[0];
  assert.equal(req.max_tokens, 100);
  assert.equal(req.system[0].cache_control.type, 'ephemeral');
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.equal(req.tools, undefined);
});

test('writeArticle retries plain when structured output is rejected', async () => {
  const an = fakeAnthropic([new Error('output_config unsupported'), textResp('{"ok":true}')]);
  const desk = createDesk({ clients: { anthropic: an }, log: { warn() {} } });
  const out = await desk.writeArticle({ model: 'm', system: 'S', user: 'U', schema: {}, maxTokens: 10 });
  assert.deepEqual(out.article, { ok: true });
  assert.equal(an.calls.length, 2);
  assert.equal(an.calls[1].output_config, undefined);
});

test('writeArticle webSearch uses the tool and skips the schema', async () => {
  const an = fakeAnthropic([textResp('{"t":1}')]);
  const desk = createDesk({ clients: { anthropic: an } });
  await desk.writeArticle({ model: 'm', system: 'S', user: 'U', schema: {}, maxTokens: 10, webSearch: true });
  assert.equal(an.calls[0].tools[0].name, 'web_search');
  assert.equal(an.calls[0].output_config, undefined);
});

test('writeArticle throws (never returns null) on bad output or missing input', async () => {
  const an = fakeAnthropic([textResp('nothing here')]);
  const desk = createDesk({ clients: { anthropic: an } });
  await assert.rejects(desk.writeArticle({ model: 'm', system: 'S', user: 'U', maxTokens: 10 }), /no JSON/);
  await assert.rejects(desk.writeArticle({ system: 'S', user: 'U', maxTokens: 10 }), /model is required/);
});

test('missing Anthropic key throws with a clear message', async () => {
  const saved = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
  const desk = createDesk({ clients: { ssm: fakeSend() } });
  await assert.rejects(desk.writeArticle({ model: 'm', system: 'S', user: 'U', maxTokens: 1 }), /no Anthropic key/);
  if (saved) process.env.ANTHROPIC_API_KEY = saved;
});

test('getParam returns fallback on ParameterNotFound, decrypts when asked', async () => {
  const ssm = { send: async (cmd) => { if (cmd.input.Name === '/missing') { const e = new Error(); e.name = 'ParameterNotFound'; throw e; } return { Parameter: { Value: 'secret' } }; } };
  const desk = createDesk({ clients: { ssm } });
  assert.equal(await desk.getParam('/missing', { fallback: 'fb' }), 'fb');
  assert.equal(await desk.getParam(null, { fallback: 'fb' }), 'fb');
  assert.equal(await desk.getParam('/key', { decrypt: true }), 'secret');
});

test('publish builds a PutObject with all fields; invalidate is skipped without a distribution', async () => {
  const s3 = fakeSend(); const cf = fakeSend();
  const desk = createDesk({ clients: { s3, cloudfront: cf }, log: { warn() {} } });
  await desk.publish({ bucket: 'b', key: 'k', body: '{}', contentType: 'application/json', cacheControl: 'public, max-age=300' });
  assert.equal(s3.sent[0].name, 'PutObjectCommand');
  assert.deepEqual(s3.sent[0].input, { Bucket: 'b', Key: 'k', Body: '{}', ContentType: 'application/json', CacheControl: 'public, max-age=300' });
  assert.equal(await desk.invalidate(['/x']), false);
  assert.equal(cf.sent.length, 0);
});

test('invalidate sends the paths when a distribution is set', async () => {
  const cf = fakeSend();
  const desk = createDesk({ distributionId: 'E123', clients: { cloudfront: cf } });
  assert.equal(await desk.invalidate(['/times*', '/sitemap.xml'], { callerReference: 'r1' }), true);
  const inp = cf.sent[0].input;
  assert.equal(inp.DistributionId, 'E123');
  assert.equal(inp.InvalidationBatch.Paths.Quantity, 2);
  assert.equal(inp.InvalidationBatch.CallerReference, 'r1');
});
