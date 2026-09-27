// Inlines the Vite build (dist/) into one self-contained HTML fragment
// suitable for single-file hosting. Usage: node scripts/build-single.mjs <out.html>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'dist/lock-mechanics.html';
const assets = join('dist', 'assets');
const files = readdirSync(assets);
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');

const html = `<title>Lock Mechanics</title>
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
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(1)} KB)`);
