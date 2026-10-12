#!/bin/sh
# Static checks for akara.studio. Runs in the pre-commit hook; run it by hand before any deploy.
set -e
cd "$(dirname "$0")/.."
node scripts/check-site.mjs
node scripts/build-jsx.mjs --check
for f in lambdas/*/index.js; do node --check "$f"; done
echo "lambdas ok: $(ls lambdas/*/index.js | wc -l | tr -d ' ') index.js files parse"
