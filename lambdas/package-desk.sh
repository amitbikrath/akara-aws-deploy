#!/bin/bash
# Package the Editorial Desk layer + the three Lambdas that use it.
# Produces: dist/editorial-desk-layer.zip, dist/twitter_poller.zip,
#           dist/instagram_poller.zip, dist/times_daily.zip
# Deploy is a separate, deliberate step (see DEPLOY-DESK.md).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist

echo "== layer deps"
(cd layers/editorial-desk/nodejs && npm install --omit=dev --no-audit --no-fund --silent)
echo "== copy Desk source into the layer (npm install prunes undeclared packages)"
rm -rf layers/editorial-desk/nodejs/node_modules/@akara
mkdir -p layers/editorial-desk/nodejs/node_modules/@akara
cp -R layers/editorial-desk/src layers/editorial-desk/nodejs/node_modules/@akara/editorial-desk

echo "== layer zip"
rm -f dist/editorial-desk-layer.zip
(cd layers/editorial-desk && zip -qr ../../dist/editorial-desk-layer.zip nodejs -x 'nodejs/package-lock.json')

for fn in twitter_poller instagram_poller; do
  echo "== $fn zip (index.js only — SDKs come from the layer)"
  rm -f dist/$fn.zip
  (cd $fn && zip -q ../dist/$fn.zip index.js)
done

echo "== times_daily zip (own modules + astronomy-engine + dynamodb clients)"
rm -f dist/times_daily.zip
(cd times_daily && npm install --omit=dev --no-audit --no-fund --silent \
  && zip -qr ../dist/times_daily.zip index.js catalog.js panchang.js render.js topics.js node_modules \
     -x 'node_modules/@anthropic-ai/*' 'node_modules/@aws-sdk/client-ssm/*' 'node_modules/@aws-sdk/client-s3/*' 'node_modules/@aws-sdk/client-cloudfront/*')

echo "== node --test"
node --test layers/editorial-desk/test/desk.test.js
ls -la dist/*.zip
