// clarify — print the next questions to ask the owner (read-only).
// Usage: node tools/clarify.mjs [--topic TOP-xxx] [--limit N]
// Used by kb-elicit's clarify loop; ranking lives in lib/clarify.mjs.
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadNotes } from '../lib/load-notes.mjs';
import { clarifyQueue } from '../lib/clarify.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1]; };

const queue = clarifyQueue(await loadNotes(ROOT), {
  topic: opt('--topic'),
  limit: Number(opt('--limit') ?? 5),
});
if (!queue.length) {
  console.log('clarify: nothing open — no Q- notes or inline markers in scope.');
} else {
  queue.forEach((q, i) => console.log(`${i + 1}. [${q.kind}] ${q.id} — ${q.text || '(no text)'}  (score ${q.score})`));
}
