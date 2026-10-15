// query — run a saved frontmatter query (read-only).
// Usage:
//   node tools/query.mjs --list
//   node tools/query.mjs <name | path.yml> [--param <value>] [--json]
// Saved queries live in queries/*.yml (format: lib/query.mjs).
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, resolve } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import yaml from 'js-yaml';
import { loadNotes } from '../lib/load-notes.mjs';
import { runQuery, checkQuery } from '../lib/query.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const QDIR = join(ROOT, 'queries');
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1]; };
const load = async (file) => yaml.load(await readFile(file, 'utf8'));

if (argv.includes('--list') || !argv.length) {
  for (const f of (await readdir(QDIR)).filter(f => f.endsWith('.yml')).sort()) {
    const spec = await load(join(QDIR, f));
    console.log(`${basename(f, '.yml')} — ${spec?.title ?? '(no title)'}`);
  }
  process.exit(0);
}

const target = argv[0];
const file = target.endsWith('.yml') ? resolve(process.cwd(), target) : join(QDIR, `${target}.yml`);
let spec;
try { spec = await load(file); } catch (e) { console.error(`query: cannot read ${file} — ${e.message}`); process.exit(2); }
const params = { param: opt('--param') };
const errors = checkQuery(spec, params);
if (errors.length) { console.error(`query: invalid ${target}:\n${errors.map(e => `  - ${e}`).join('\n')}`); process.exit(2); }

const rows = runQuery(spec, await loadNotes(ROOT), params);
if (argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const cols = rows.length ? Object.keys(rows[0]) : (spec.show ?? ['id', 'type', 'title', 'status']);
  const cell = (v) => (v === undefined || v === null ? '' : Array.isArray(v) ? v.join(', ') : String(v)).replace(/\|/g, '\|');
  console.log(`## ${spec.title} (${rows.length})\n`);
  console.log(`| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|`);
  for (const r of rows) console.log(`| ${cols.map(c => cell(r[c])).join(' | ')} |`);
}
