const { SSMClient, GetParameterCommand, PutParameterCommand } = require('@aws-sdk/client-ssm');

const PROMPT_PARAM = process.env.ARTICLE_PROMPT_PARAM_NAME;
const MODEL_PARAM = process.env.ARTICLE_MODEL_PARAM_NAME;

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-opus-4-7',
  'claude-haiku-4-5',
]);

const ssm = new SSMClient({ region: process.env.AWS_REGION });

async function getParam(name) {
  try {
    const r = await ssm.send(new GetParameterCommand({ Name: name }));
    return r.Parameter?.Value || '';
  } catch (e) {
    if (e.name === 'ParameterNotFound') return '';
    throw e;
  }
}

async function setParam(name, value) {
  await ssm.send(
    new PutParameterCommand({
      Name: name,
      Value: value,
      Type: 'String',
      Overwrite: true,
    })
  );
}

function httpResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod;

  try {
    if (method === 'GET') {
      const [prompt, model] = await Promise.all([
        getParam(PROMPT_PARAM),
        getParam(MODEL_PARAM),
      ]);
      return httpResponse(200, {
        ok: true,
        prompt,
        model: model || 'claude-sonnet-4-6',
        allowedModels: Array.from(ALLOWED_MODELS),
      });
    }

    if (method === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      const updates = [];

      if (typeof payload.prompt === 'string') {
        if (payload.prompt.length > 8000) {
          return httpResponse(400, { ok: false, error: 'prompt too long (max 8000 chars)' });
        }
        updates.push(setParam(PROMPT_PARAM, payload.prompt));
      }

      if (typeof payload.model === 'string') {
        if (!ALLOWED_MODELS.has(payload.model)) {
          return httpResponse(400, {
            ok: false,
            error: `model must be one of: ${Array.from(ALLOWED_MODELS).join(', ')}`,
          });
        }
        updates.push(setParam(MODEL_PARAM, payload.model));
      }

      if (updates.length === 0) {
        return httpResponse(400, { ok: false, error: 'no updatable fields in request' });
      }

      await Promise.all(updates);
      return httpResponse(200, { ok: true });
    }

    return httpResponse(405, { ok: false, error: 'method not allowed' });
  } catch (err) {
    console.error('Config handler failed:', err);
    return httpResponse(500, { ok: false, error: err.message });
  }
};
