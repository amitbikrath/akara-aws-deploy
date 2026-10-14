// Static checks for the live jsx site. Run via scripts/check.sh.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');

const root = path.resolve(import.meta.dirname, '..');
const pub = path.join(root, 'frontend/public');
const fail = [];

// 1. The ordered script list must match in all three shells.
const layout = fs.readFileSync(path.join(root, 'frontend/src/app/layout.tsx'), 'utf8');
const block = layout.match(/AKARA_SCRIPTS = \[([\s\S]*?)\]/)?.[1] ?? '';
const fromLayout = [...block.matchAll(/'\/akara\/(js\/[^']+\.js)'/g)].map(m => m[1]);
const fromHtml = f => [...fs.readFileSync(path.join(pub, 'akara', f), 'utf8')
  .matchAll(/<script src="(js\/[^"]+\.js)"/g)].map(m => m[1]);
for (const f of ['index.html', 'akara.html']) {
  const list = fromHtml(f);
  if (list.join() !== fromLayout.join())
    fail.push(`script list mismatch: layout.tsx AKARA_SCRIPTS vs akara/${f}\n  layout: ${fromLayout.join(' ')}\n  ${f}: ${list.join(' ')}`);
}
if (!fromLayout.length) fail.push('could not read AKARA_SCRIPTS from layout.tsx');

// 2. Every jsx under public/ must parse.
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(pub);
for (const f of files.filter(f => f.endsWith('.jsx'))) {
  const out = ts.transpileModule(fs.readFileSync(f, 'utf8'), {
    fileName: f, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, allowJs: true, target: ts.ScriptTarget.ES2022 },
  });
  for (const d of out.diagnostics ?? []) {
    const { line } = d.file ? d.file.getLineAndCharacterOfPosition(d.start) : { line: -1 };
    fail.push(`${path.relative(root, f)}:${line + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
  }
}

// 3. Every local .jsx/.js an html page loads must exist on disk.
for (const f of files.filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(f, 'utf8');
  for (const [, src] of html.matchAll(/<script[^>]*\ssrc="([^"]+\.jsx?)"/g)) {
    if (/^(https?:)?\/\//.test(src) || src.startsWith('/_next/')) continue;
    const p = src.startsWith('/') ? path.join(pub, src) : path.join(path.dirname(f), src);
    if (!fs.existsSync(p)) fail.push(`${path.relative(root, f)} loads missing ${src}`);
  }
}

// 4. The boot rescue must be inlined, unchanged, in every shell (before the scripts it watches).
const rescue = fs.readFileSync(path.join(root, 'frontend/src/app/boot-rescue.js'), 'utf8');
if (!/BOOT_RESCUE[\s\S]*__html: BOOT_RESCUE/.test(layout)) fail.push('layout.tsx does not inline BOOT_RESCUE');
for (const f of ['index.html', 'akara.html']) {
  const html = fs.readFileSync(path.join(pub, 'akara', f), 'utf8');
  const at = html.indexOf('<script>\n' + rescue + '</script>');
  if (at < 0) fail.push(`akara/${f}: boot-rescue copy missing or differs from src/app/boot-rescue.js`);
  else if (at > html.indexOf('<script src="vendor/')) fail.push(`akara/${f}: boot-rescue must come before the vendor scripts`);
}

if (fail.length) { console.error('check FAILED\n- ' + fail.join('\n- ')); process.exit(1); }
console.log(`check ok: ${fromLayout.length} scripts in lockstep, ${files.filter(f => f.endsWith('.jsx')).length} jsx parse, html script refs resolve`);
