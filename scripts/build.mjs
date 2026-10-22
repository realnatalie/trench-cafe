#!/usr/bin/env node
/**
 * Trench Cafe build.
 *
 * The browser game is written as a set of plain ES modules in client/src that share one scope: they are concatenated in a
 * fixed order (see CLIENT_SOURCES), bundled with three.js by esbuild, and inlined together with the fonts and the page shell
 * (client/shell.html) into a single self-contained HTML file. Nothing is loaded from a CDN at runtime.
 *
 * Outputs
 *   public/index.html      the page the Worker serves (talks to the Durable Object over /ws)
 *   dist/standalone.html   an offline preview with no server (single player, test launches only)
 *   dist/app.js            the concatenated source before bundling, handy for linting
 *
 * Usage
 *   npm run build                      build everything
 *   SITE_URL=https://trenchcafe.com npm run build    set the absolute URL used in link previews
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const SITE_URL = (process.env.SITE_URL || 'https://clout-cafe.fkamilev102.workers.dev').replace(/\/$/, '');

import { CLIENT_SOURCES } from './sources.mjs';

const read = f => readFileSync(join(ROOT, f), 'utf8');
const kb = n => (n / 1024).toFixed(0) + ' KB';

function concatSources() {
  // shared server modules end with `export { ... }`: the browser copy drops it
  return CLIENT_SOURCES.map(f => `/* ---- ${f} ---- */\n` + read(f).replace(/^export \{[^}]*\};?\s*$/gm, '')).join('\n');
}

async function bundle(src) {
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  writeFileSync(join(ROOT, 'dist/app.js'), src);
  const res = await build({
    entryPoints: [join(ROOT, 'dist/app.js')], absWorkingDir: ROOT,
    bundle: true, format: 'esm', minify: true, target: ['es2020'], write: false, legalComments: 'none', logLevel: 'warning'
  });
  return res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
}

function fontFace(pkg, family) {
  const file = require.resolve(`@fontsource-variable/${pkg}/files/${pkg}-latin-wght-normal.woff2`);
  const b64 = readFileSync(file).toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:100 900;src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+FEFF,U+FFFD}`;
}

function shellParts() {
  let a = read('client/shell.html');
  a = a.replace(/<link rel="preconnect"[^>]*>\n?/g, '')
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n?/g, '')
    .replace(/<script type="importmap">[\s\S]*?<\/script>\n?/g, '')
    .replace('<title>Trench Cafe</title>', '');
  const i = a.indexOf('<canvas id="gl"');
  if (i < 0) throw new Error('client/shell.html: <canvas id="gl"> not found');
  return { head: a.slice(0, i), body: a.slice(i) };
}

const DESCRIPTION = 'A 3D net cafe in the Solana trenches. Every desk is a live pump.fun coin. Sit down, launch, and let the whole lobby watch your chart.';
const META = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content">
<title>Trench Cafe</title>
<meta name="description" content="GM, degen. ${DESCRIPTION}">
<meta name="theme-color" content="#03020c">
<meta property="og:type" content="website">
<meta property="og:title" content="Trench Cafe">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:image" content="${SITE_URL}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Trench Cafe">
<meta name="twitter:description" content="${DESCRIPTION}">
<meta name="twitter:image" content="${SITE_URL}/og.png">
<meta name="format-detection" content="telephone=no">
<meta name="apple-mobile-web-app-capable" content="yes">
`;

/** Shown instead of a blank page when WebGL is missing or the boot throws. */
const GUARD = `<script>
(function () {
  var shown = false;
  function crash(title, detail) {
    if (shown) return; shown = true;
    var show = function () { var d = document.createElement('div'); d.id = 'crash'; d.innerHTML = '<b>' + title + '</b>' + 'Reload the page. If it keeps happening, send a screenshot of this box.' + (detail ? '<code>' + String(detail).replace(/[<>&]/g, '') .slice(0, 300) + '</code>' : '') + '<button type="button" onclick="location.reload()">RELOAD</button>'; document.body.appendChild(d); document.documentElement.classList.remove('boot'); };
    if (document.body) show(); else addEventListener('DOMContentLoaded', show);
  }
  try { var c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) crash('3D IS OFF IN THIS BROWSER', 'WebGL is not available. Try Chrome or Safari, or turn on hardware acceleration.'); } catch (e) { }
  addEventListener('error', function (e) { if (!e || !e.message || !document.documentElement.classList.contains('boot')) return; if (/ResizeObserver|Script error|redefine property|ethereum|metamask|solflare|backpack|coinbase|phantom|tronlink|keplr|wallet/i.test(e.message)) return; if (/extension:/i.test(e.filename || '')) return; crash('SOMETHING BROKE', e.message + (e.filename ? ' @' + (e.lineno || '') : '')); });
  setTimeout(function () { if (document.documentElement.classList.contains('boot')) crash('STILL LOADING', 'The page took too long to start.'); }, 25000);
})();
</script>
`;

const page = (parts, fonts, js, serverTag) =>
  '<!doctype html>\n<html lang="en" class="boot">\n<head>\n' + META + GUARD + fonts + '\n' + parts.head + '\n' + serverTag + '\n</head>\n<body>\n' + parts.body + '\n<script type="module">\n' + js + '\n</script>\n</body>\n</html>\n';

const t0 = Date.now();
const js = await bundle(concatSources());
const fonts = '<style>' + fontFace('unbounded', 'Unbounded') + fontFace('onest', 'Onest') + fontFace('jetbrains-mono', 'JetBrains Mono') + '</style>';
const parts = shellParts();
const outputs = {
  'public/index.html': page(parts, fonts, js, "<script>window.CC_SERVER = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';</script>"),
  'dist/standalone.html': page(parts, fonts, js, '')
};
for (const [f, html] of Object.entries(outputs)) writeFileSync(join(ROOT, f), html);
for (const f of Object.keys(outputs)) console.log(`  ${f.padEnd(22)} ${kb(statSync(join(ROOT, f)).size)}`);
console.log(`built in ${Date.now() - t0} ms (js ${kb(js.length)}, ${CLIENT_SOURCES.length} sources)`);
