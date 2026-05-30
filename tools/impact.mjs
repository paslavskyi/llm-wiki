import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkMarkdown } from '../lib/walk.mjs';
import { readNote } from '../lib/note.mjs';

// outgoing edges: id -> [linked ids]; incoming edges: id -> [linker ids]
function buildEdges(notes) {
  const out = new Map();
  const inc = new Map();
  for (const n of notes) {
    const id = n.frontmatter.id;
    if (!id) continue;
    if (!out.has(id)) out.set(id, []);
    for (const t of n.links) {
      out.get(id).push(t);
      if (!inc.has(t)) inc.set(t, []);
      inc.get(t).push(id);
    }
  }
  return { out, inc };
}

function bfs(start, edges, depth) {
  const seen = new Set();
  let frontier = [start];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const node of frontier) {
      for (const nb of edges.get(node) ?? []) {
        if (nb === start || seen.has(nb)) continue;
        seen.add(nb);
        next.push(nb);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return [...seen];
}

export function computeImpact(id, notes, depth = 1) {
  const { out, inc } = buildEdges(notes);
  return {
    incoming: bfs(id, inc, depth),
    outgoing: bfs(id, out, depth),
  };
}

// CLI: node tools/impact.mjs <ID> [--depth N]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const id = args.find(a => !a.startsWith('--'));
  const di = args.indexOf('--depth');
  const depth = di >= 0 ? Number(args[di + 1]) : 1;
  if (!id) { console.error('usage: impact <ID> [--depth N]'); process.exit(1); }
  const root = process.cwd();
  const files = await walkMarkdown(join(root, 'knowledge'));
  const notes = [];
  for (const fp of files) { try { notes.push(await readNote(fp)); } catch {} }
  const { incoming, outgoing } = computeImpact(id, notes, depth);
  console.log(`impact of ${id} (depth ${depth}):`);
  console.log(`  incoming (${incoming.length}): ${incoming.sort().join(', ') || '—'}`);
  console.log(`  outgoing (${outgoing.length}): ${outgoing.sort().join(', ') || '—'}`);
}
