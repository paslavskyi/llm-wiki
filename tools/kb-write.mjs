// kb-write — batch-write notes through the heal/validate write pipeline.
//
// Reads JSON from stdin: a single note object or an array of them. Each note:
//   {
//     "domainDir":   "product/domain",        // path under knowledge/
//     "frontmatter": { "id": "...", "type": "...", "title": "...",
//                      "status": "...", "summary": "...", ... },
//     "body":        "markdown string"  OR  ["line 1", "line 2", ...]
//   }
// (alias: "fm" may be used instead of "frontmatter"; body lines are joined "\n".)
//
// Usage:
//   node tools/kb-write.mjs [--today YYYY-MM-DD] < notes.json
//   echo '<json>' | npm run kb:write
//
// Why: there is no CLI over write-note.mjs, and kb-capture writes one note at a
// time. This lets a coherent batch of notes (new + updates) go through the SAME
// pipeline (heal: ordered keys, created/updated, dedupe links, resolve deprecated
// refs; per-note schema validation; atomic write; rename-in-place dedup) in one
// deterministic pass. JSON input avoids the JS-string apostrophe footgun.
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { writeNote, targetPathFor } from './write-note.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function parseArgs(argv) {
  const opts = { today: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--today') opts.today = argv[++i];
  }
  return opts;
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

function normalize(note) {
  const fm = note.frontmatter ?? note.fm;
  if (!note.domainDir) throw new Error('note missing "domainDir"');
  if (!fm || !fm.id || !fm.type || !fm.title) {
    throw new Error(`note missing frontmatter id/type/title (got id=${fm?.id})`);
  }
  const body = Array.isArray(note.body) ? note.body.join('\n') : (note.body ?? '');
  return { domainDir: note.domainDir, fm, body };
}

const { today } = parseArgs(process.argv.slice(2));
const raw = await readStdin();
if (!raw.trim()) {
  console.error('kb-write: no JSON on stdin');
  process.exit(2);
}
let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error(`kb-write: invalid JSON — ${e.message}`);
  process.exit(2);
}
const notes = Array.isArray(parsed) ? parsed : [parsed];

let ok = 0, fail = 0;
for (const n of notes) {
  let note;
  try {
    note = normalize(n);
  } catch (e) {
    fail++; console.error(`✗ ${e.message}`); continue;
  }
  const target = targetPathFor(ROOT, note.domainDir, note.fm.id, note.fm.title);
  try {
    const { created } = await writeNote(ROOT, target, { frontmatter: note.fm, body: note.body }, { today });
    ok++;
    console.log(`${created ? 'created' : 'updated'} ${note.fm.id}`);
  } catch (e) {
    fail++; console.error(`✗ ${note.fm.id}: ${e.message}`);
  }
}
console.log(`kb-write: ${ok}/${notes.length} written (${fail} failed).`);
process.exit(fail ? 1 : 0);
