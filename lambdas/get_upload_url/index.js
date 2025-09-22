// Minimal handler: OK to replace later
exports.handler = async (event) => ({
  statusCode: 200,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ok: true, fn: process.env.AWS_LAMBDA_FUNCTION_NAME })
});