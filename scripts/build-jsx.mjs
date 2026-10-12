// Compile the live site's jsx into plain js, once, on this machine — so phones
// no longer download Babel (3 MB) and compile 15 files before the page appears.
//
//   node scripts/build-jsx.mjs            write frontend/public/akara/js/*.js
//   node scripts/build-jsx.mjs --check    exit 1 if any js is missing or stale
//
// Options copy what @babel/standalone 7.29.0 applied to <script type="text/babel">
// in the browser (presets react+env, the same three plugins, no targets), so the
// compiled code behaves exactly like before. Edit the .jsx; never the .js.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const Babel = createRequire(import.meta.url)('@babel/standalone');

const dir = path.resolve(import.meta.dirname, '../frontend/public/akara');
const outDir = path.join(dir, 'js');
const check = process.argv.includes('--check');

export function compile(name) {
  const src = fs.readFileSync(path.join(dir, name), 'utf8');
  const { code } = Babel.transform(src, {
    filename: name,
    presets: ['react', 'env'],
    plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
    compact: true,
    comments: false,
  });
  return `// GENERATED from /akara/${name} by scripts/build-jsx.mjs. Edit the .jsx.\n${code}\n`;
}

const names = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));
const stale = [];
if (!check) fs.mkdirSync(outDir, { recursive: true });
for (const name of names) {
  const out = path.join(outDir, name.replace(/\.jsx$/, '.js'));
  const code = compile(name);
  const have = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  if (have === code) continue;
  if (check) stale.push(path.relative(process.cwd(), out));
  else fs.writeFileSync(out, code);
}
if (check && stale.length) {
  console.error(`compiled js is stale — run: node scripts/build-jsx.mjs\n  ${stale.join('\n  ')}`);
  process.exit(1);
}
console.log(`${check ? 'js up to date' : 'compiled'}: ${names.length} jsx -> frontend/public/akara/js/`);
