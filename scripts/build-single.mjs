// Inlines the Vite build (dist/) into one self-contained HTML fragment
// suitable for single-file hosting. Usage: node scripts/build-single.mjs <out.html> [--full]
// --full wraps it in a complete document (doctype, mobile viewport) so the
// file can be opened directly in a phone browser.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const args = process.argv.slice(2);
const full = args.includes('--full');
const out = args.find((a) => !a.startsWith('--')) ?? 'dist/lock-mechanics.html';
const assets = join('dist', 'assets');
const files = readdirSync(assets);
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');

const body = `<title>Lock Mechanics</title>
<meta name="description" content="実在する錠前の仕組みを見て、鍵そのものを削って作るパズルゲーム">
<style>
html, body { height: 100%; background: #0b1118; color-scheme: dark; }
${css}
</style>
<div id="app"></div>
<script type="module">
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`;
const html = full
  ? `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#0b1118">
<meta name="apple-mobile-web-app-capable" content="yes">
${body.replace('<div id="app"></div>', '</head>\n<body>\n<div id="app"></div>')}</body>
</html>
`
  : body;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(1)} KB)`);
