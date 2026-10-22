#!/usr/bin/env node
/**
 * Translation check: every key the game looks up with t('...') or data-i="..." must exist in all five languages.
 * The base strings live in `const I18N = { ... }` in client/src/00-core.js; client/src/01-i18n.js merges more blocks into it.
 * Keys built at runtime (t('pl_' + id)) are reported by prefix and skipped.
 *
 *   npm run check:i18n
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { CLIENT_SOURCES } from './sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(ROOT, f), 'utf8');
const LANGS = ['en', 'zh', 'ja', 'ko', 'es'];

const core = read('client/src/00-core.js');
const start = core.indexOf('const I18N = {');
const end = core.indexOf('\n};', start) + 3;
if (start < 0 || end < 3) throw new Error('I18N block not found in client/src/00-core.js');
const ctx = { window: {} };
vm.runInNewContext(core.slice(start, end).replace('const I18N', 'var I18N') + '\n' + read('client/src/01-i18n.js').replace(/^const /gm, 'var '), ctx);
const I18N = ctx.I18N;

const code = CLIENT_SOURCES.map(read).join('\n') + read('client/shell.html');
const keys = new Set([...code.matchAll(/\bt\('([a-z0-9_]+)'(\s*\+)?/g)].map(m => m[2] ? m[1] + '*' : m[1]).concat([...code.matchAll(/data-ip?="([a-z0-9_]+)"/g)].map(m => m[1])));
const isDyn = k => k.endsWith('_') || k.endsWith('*');
const dynamic = [...keys].filter(isDyn).map(k => k.replace('*', ''));
let missing = 0;
for (const L of LANGS) {
  const miss = [...keys].filter(k => !isDyn(k) && I18N[L][k] === undefined && I18N.en[k] === undefined);
  const untranslated = [...keys].filter(k => !isDyn(k) && I18N.en[k] !== undefined && I18N[L][k] === undefined);
  missing += miss.length;
  console.log(`${L}: ${Object.keys(I18N[L]).length} strings` + (miss.length ? `, MISSING ${miss.join(' ')}` : '') + (L !== 'en' && untranslated.length ? `, falls back to English: ${untranslated.length}` : ''));
}
console.log(`${keys.size} keys used, ${dynamic.length} runtime prefixes (${dynamic.join(' ')})`);
process.exit(missing ? 1 : 0);
