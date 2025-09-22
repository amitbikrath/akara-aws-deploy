// Minimal handler for deployment sanity. Replace with real logic later.
exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ok: true,
      fn: process.env.AWS_LAMBDA_FUNCTION_NAME,
      env: process.env,
      eventPreview: typeof event === "object" ? Object.keys(event) : typeof event
    })
  };
};