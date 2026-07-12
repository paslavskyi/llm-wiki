// plan CLI — the ONLY sanctioned way to change the operational plan (DEC-032).
// Deterministic list surgery + pipeline write + validate + reindex + an atomic
// git commit whose message plan-history relies on. The kb-plan skill translates
// dialogue into these commands; it never edits YAML by hand.
//
// Usage:
//   node tools/plan.mjs show
//   node tools/plan.mjs take [ID]            # start item (default: queue head)
//   node tools/plan.mjs done ID              # completed → leaves the plan
//   node tools/plan.mjs drop ID              # removed, NOT completed
//   node tools/plan.mjs defer ID             # park to backlog (accepts new ids)
//   node tools/plan.mjs promote ID [--pos N] # into queue (from backlog or new)
//   node tools/plan.mjs move ID --pos N      # reorder within queue
//   node tools/plan.mjs set [--active a,b] [--queue c,d] [--backlog e]
//   flags: --no-commit (skip the git commit), --today YYYY-MM-DD
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadNotes } from '../lib/load-notes.mjs';
import { applyPlanOp } from '../lib/plan-core.mjs';
import { loadPlanHistory } from '../lib/plan-history.mjs';
import { writeNote } from './write-note.mjs';
import { validateNotes } from './validate.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const run = promisify(execFile);

function parseArgs(argv) {
  const out = { verb: argv[0], id: undefined, pos: undefined, lists: {}, commit: true, today: undefined };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pos') out.pos = Number(argv[++i]);
    else if (a === '--no-commit') out.commit = false;
    else if (a === '--today') out.today = argv[++i];
    else if (a === '--active') out.lists.active = splitIds(argv[++i]);
    else if (a === '--queue') out.lists.queue = splitIds(argv[++i]);
    else if (a === '--backlog') out.lists.backlog = splitIds(argv[++i]);
    else if (!a.startsWith('--') && !out.id) out.id = a;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}
const splitIds = s => String(s ?? '').split(',').map(x => x.trim()).filter(Boolean);

async function loadKb() {
  const notes = await loadNotes(ROOT);
  const byId = new Map(notes.map(n => [n.frontmatter.id, n]));
  const plan = notes.find(n => n.frontmatter.type === 'plan' && n.frontmatter.status !== 'deprecated');
  return { byId, plan };
}

function assertKnownIds(ids, byId, planId) {
  for (const id of ids) {
    const n = byId.get(id);
    if (!n) throw new Error(`${id} does not exist in the KB`);
    if (n.frontmatter.status === 'deprecated') {
      const to = n.frontmatter.superseded_by;
      throw new Error(`${id} is deprecated${to ? ` — use ${to}` : ''}`);
    }
    if (id === planId) throw new Error(`the plan cannot contain itself`);
  }
}

function fmtLists(fm) {
  const line = (name, items, ordered = false) => items.length
    ? `${name}:\n${items.map((x, i) => `  ${ordered ? `${i + 1}. ` : '- '}${x}`).join('\n')}`
    : `${name}: (порожньо)`;
  return [
    line('АКТИВНІ (в розробці)', fm.active ?? []),
    line('ЧЕРГА (TODO, у порядку виконання)', fm.queue ?? [], true),
    line('BACKLOG', fm.backlog ?? []),
  ].join('\n');
}

const args = parseArgs(process.argv.slice(2));
if (!args.verb) {
  console.error('plan: verb required (show|take|done|drop|defer|promote|move|set)');
  process.exit(2);
}

const { byId, plan } = await loadKb();
if (!plan) {
  console.error('plan: no live plan note found — create PLAN-001 first (kb-capture / kb:write)');
  process.exit(1);
}

if (args.verb === 'show') {
  console.log(`${plan.frontmatter.id} — ${plan.frontmatter.title}\n`);
  console.log(fmtLists(plan.frontmatter));
  const hist = await loadPlanHistory(ROOT);
  if (hist.done.length) {
    console.log('\nDONE (нещодавні):');
    for (const e of hist.done.slice(0, 10)) console.log(`  ✓ ${e.id}  ${e.date}  (${e.hash})`);
  }
  process.exit(0);
}

// 1. deterministic surgery (pure)
const { lists, message } = applyPlanOp(plan.frontmatter, {
  verb: args.verb, id: args.id, pos: args.pos, lists: args.lists,
});

// 2. every id entering/staying in the plan must be live
assertKnownIds([...lists.active, ...lists.queue, ...lists.backlog], byId, plan.frontmatter.id);

// 3. write through the pipeline (heal + schema + atomic)
const fm = { ...plan.frontmatter, ...lists };
await writeNote(ROOT, plan.filePath, { frontmatter: fm, body: plan.body }, { today: args.today });

// 4. full validate (disjointness, singleton, dangling refs)
const { errors } = await validateNotes(ROOT);
if (errors.length) {
  console.error(`✗ validation failed after plan op:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// 5. reindex (plan edges feed backlinks/indexes)
await run('node', [join(ROOT, 'tools', 'reindex.mjs')], { cwd: ROOT });

// 6. atomic commit — plan-history depends on these commits/messages
if (args.commit) {
  const rel = relative(ROOT, plan.filePath).replaceAll('\\', '/');
  await run('git', ['add', rel, 'index/'], { cwd: ROOT });
  await run('git', ['commit', '-m', message], { cwd: ROOT });
  console.log(`✓ ${message} (committed)`);
} else {
  console.log(`✓ ${message} (NOT committed — done-history lags until you commit)`);
}
console.log('\n' + fmtLists(fm));
