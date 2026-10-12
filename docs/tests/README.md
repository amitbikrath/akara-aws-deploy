# Shop checks (no build system needed)

- `node shop-logic.test.mjs` — runs the pure block (`// @pure-start` … `// @pure-end`) of
  `frontend/public/akara/shop-page.jsx` against `storefront-fixture-2026-09-07.json`.
- Syntax check of any jsx before deploy (one-off install into a scratch dir):
  `npm i @babel/core @babel/preset-react` then
  `node -e "require('@babel/core').transformSync(require('fs').readFileSync('<file>.jsx','utf8'),{presets:['@babel/preset-react'],filename:'x.jsx'});console.log('OK')"`.
- `preview_proxy.py <port>` — serves local `/akara/*.jsx` from disk (2 s delay so Next hydrates first),
  everything else from live akara.studio. Wired to `.claude/launch.json` as `akara-preview-proxy`.
- Refresh the fixture: the Storefront GraphQL query in `shop-logic.test.mjs` header comment / handoff memory.
