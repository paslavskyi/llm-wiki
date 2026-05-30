# LLM-Wiki Phase 2b (Evolution & Integrity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the knowledge graph visible-when-filling (`graph.mjs` → `index/health.md`, git pre-commit) and safe-when-evolving (a single "reconstruct-to-healthy" write model via `lib/heal.mjs` + `tools/write-note.mjs`, plus `kb-evolve`, `kb-sanitize`, `impact.mjs`).

**Architecture:** Two halves, implemented B→A. Half B adds a non-blocking health report and a pre-commit guard. Half A introduces a deterministic write pipeline: `lib/heal.mjs` (pure rule_set A–E) reconstructs a note to a healthy state; `tools/write-note.mjs` writes it atomically (temp-in-same-dir → local validate → atomic rename with Windows retry). Two skills (`kb-evolve`, `kb-sanitize`) drive note evolution and deferred debt migration; `tools/impact.mjs` shows blast radius.

**Tech Stack:** Node.js v24 (ESM, `node:test`), existing deps (`gray-matter`, `ajv`, `js-yaml`). No new deps (Jaro-Winkler is hand-written).

**Spec:** `docs/superpowers/specs/2026-05-30-llm-wiki-phase2b-evolution-integrity-design.md`

**Builds on (Phase 1/2a contracts — do not break):**
- `lib/note.mjs` → `readNote(path)` → `{filePath, fileName, frontmatter, body, links}`; `extractLinks(fm, body)`.
- `lib/walk.mjs` → `walkMarkdown(dir)` (sorted, [] if missing).
- `lib/domain.mjs` → `domainOf(path)`.
- `lib/mindmap.mjs` → `buildTree(notes)` → `{roots, unassigned}`; node `{id,title,summary,parent,children,notes}`.
- `lib/config.mjs` → `loadConfig(rootDir)` → currently `{...DEFAULTS, ...parsed}` with `DEFAULTS={mode,language,owner}`.
- `lib/schemas.mjs` → `loadValidators()` → `{validatorFor, ajv}`.
- `tools/validate.mjs` → `validateNotes(rootDir)` → `{errors}`.
- `tools/reindex.mjs` → `buildIndexes(rootDir)` → `{files}`; `writeIndexes(rootDir)`; `cell(v)`, `BANNER`.
- `index/backlinks.json` shape: `{ targetId: [sourceId, ...] }` (sorted).
- Tests in `test/*.test.mjs`; helpers `test/helpers.mjs` → `makeTmpDir`, `writeFileDeep`, `cleanup`.

**Scope:** Phase 2b only. Deferred: journal/recap (2c), full autonomous polish, Phase 3 doc generation.

---

## File Structure

```
lib/config.mjs                     # MODIFY — nested health.duplicates defaults merge
lib/jaro-winkler.mjs               # NEW — pure string similarity (no deps)
lib/heal.mjs                       # NEW — healNote(): rule_set A–E (pure)
tools/graph.mjs                    # NEW — health report → index/health.md (exit 0)
tools/impact.mjs                   # NEW — computeImpact + CLI (blast radius)
tools/write-note.mjs               # NEW — atomic write (temp→local-validate→rename+retry)
tools/install-hooks.mjs            # NEW — npm run install-hooks
tools/hooks/pre-commit             # NEW — versioned pre-commit source
kb.config.yml                      # MODIFY — optional health.duplicates section
package.json                       # MODIFY — add graph/impact/install-hooks scripts
.claude/skills/kb-capture/SKILL.md # MODIFY — write via write-note.mjs
.claude/skills/kb-evolve/SKILL.md      # NEW
.claude/skills/kb-sanitize/SKILL.md    # NEW
CLAUDE.md, STATE.md                # MODIFY
test/config.test.mjs               # MODIFY — health.duplicates merge
test/jaro-winkler.test.mjs         # NEW
test/heal.test.mjs                 # NEW
test/graph.test.mjs                # NEW
test/impact.test.mjs               # NEW
test/write-note.test.mjs           # NEW
index/health.md                    # GENERATED (committed, like MAP.md)
```

---

### Task 1: `lib/config.mjs` — nested `health.duplicates` defaults

**Files:**
- Modify: `lib/config.mjs`
- Test: `test/config.test.mjs` (append)

The current `loadConfig` does a flat `{...DEFAULTS, ...parsed}`. We need a nested default for `health.duplicates` so a missing/partial `health` section still yields full defaults, without breaking existing `mode`/`language`/`owner`.

- [ ] **Step 1: Append the failing tests** to `test/config.test.mjs`

```javascript
test('loadConfig provides health.duplicates defaults when absent', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'kb.config.yml'), 'mode: debug\n');
    const cfg = await loadConfig(dir);
    assert.equal(cfg.health.duplicates.enabled, false);
    assert.equal(cfg.health.duplicates.threshold, 0.92);
  } finally { await cleanup(dir); }
});

test('loadConfig merges a partial health.duplicates section', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'kb.config.yml'),
      'health:\n  duplicates:\n    enabled: true\n');
    const cfg = await loadConfig(dir);
    assert.equal(cfg.health.duplicates.enabled, true);   // from file
    assert.equal(cfg.health.duplicates.threshold, 0.92); // from default
  } finally { await cleanup(dir); }
});

test('loadConfig health defaults present even with no file', async () => {
  const dir = await makeTmpDir();
  try {
    const cfg = await loadConfig(dir);
    assert.equal(cfg.health.duplicates.enabled, false);
    assert.equal(cfg.health.duplicates.threshold, 0.92);
    assert.equal(cfg.mode, 'debug'); // existing defaults intact
  } finally { await cleanup(dir); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/config.test.mjs`
Expected: FAIL — `cfg.health` is undefined.

- [ ] **Step 3: Rewrite `lib/config.mjs`**

```javascript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';

const DEFAULTS = {
  mode: 'debug',
  language: 'uk',
  owner: '',
  health: {
    duplicates: { enabled: false, threshold: 0.92 },
  },
};

export async function loadConfig(rootDir) {
  let parsed = {};
  try {
    const raw = await readFile(join(rootDir, 'kb.config.yml'), 'utf8');
    parsed = yaml.load(raw) ?? {};
  } catch {
    parsed = {};
  }
  return {
    ...DEFAULTS,
    ...parsed,
    health: {
      ...DEFAULTS.health,
      ...(parsed.health ?? {}),
      duplicates: {
        ...DEFAULTS.health.duplicates,
        ...((parsed.health ?? {}).duplicates ?? {}),
      },
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/config.test.mjs`
Expected: PASS (existing config tests + 3 new).

- [ ] **Step 5: Commit**

```bash
git add lib/config.mjs test/config.test.mjs
git commit -m "feat: add nested health.duplicates config defaults"
```

---

### Task 2: `lib/jaro-winkler.mjs` — pure string similarity

**Files:**
- Create: `lib/jaro-winkler.mjs`
- Test: `test/jaro-winkler.test.mjs`

Jaro-Winkler similarity in [0,1], plus a `normalize()` used before comparison (lowercase, trim, collapse whitespace, strip punctuation). No dependencies.

- [ ] **Step 1: Write the failing test**

`test/jaro-winkler.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jaroWinkler, normalizeForCompare } from '../lib/jaro-winkler.mjs';

test('identical strings score 1', () => {
  assert.equal(jaroWinkler('budget', 'budget'), 1);
});

test('completely different strings score low', () => {
  assert.ok(jaroWinkler('budget', 'xyzzy') < 0.5);
});

test('near-exact titles score high (>= 0.92)', () => {
  assert.ok(jaroWinkler('create monthly budget', 'create monthy budget') >= 0.92);
});

test('common-prefix boosts score (Winkler)', () => {
  const jw = jaroWinkler('marhta', 'martha');
  assert.ok(jw > 0.96 && jw <= 1);
});

test('empty strings: two empties are equal, one empty is 0', () => {
  assert.equal(jaroWinkler('', ''), 1);
  assert.equal(jaroWinkler('abc', ''), 0);
});

test('normalizeForCompare lowercases, trims, collapses ws, strips punctuation', () => {
  assert.equal(normalizeForCompare('  Create,  Monthly  Budget! '), 'create monthly budget');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/jaro-winkler.test.mjs`
Expected: FAIL — `Cannot find module '../lib/jaro-winkler.mjs'`.

- [ ] **Step 3: Write `lib/jaro-winkler.mjs`**

```javascript
// Jaro-Winkler string similarity in [0,1]. Pure, no dependencies.

export function normalizeForCompare(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // strip punctuation → space
    .replace(/\s+/g, ' ')
    .trim();
}

function jaro(a, b) {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t /= 2;
  return (matches / a.length + matches / b.length + (matches - t) / matches) / 3;
}

export function jaroWinkler(a, b, prefixScale = 0.1) {
  a = String(a ?? '');
  b = String(b ?? '');
  const j = jaro(a, b);
  let prefix = 0;
  const maxPrefix = 4;
  while (prefix < maxPrefix && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix++;
  }
  return j + prefix * prefixScale * (1 - j);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/jaro-winkler.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/jaro-winkler.mjs test/jaro-winkler.test.mjs
git commit -m "feat: add Jaro-Winkler similarity helper"
```

---

### Task 3: `tools/graph.mjs` — health report → `index/health.md`

**Files:**
- Create: `tools/graph.mjs`
- Test: `test/graph.test.mjs`

Pure `buildHealth(rootDir, opts)` → `{ markdown }` (tests assert on it), plus `writeHealth(rootDir, opts)` and a CLI. Reads notes via walk+readNote and backlinks via `buildIndexes`. Always exit 0. `opts.duplicates` (bool) + `opts.threshold` (number) come from config, overridable by CLI `--duplicates`.

- [ ] **Step 1: Write the failing test**

`test/graph.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { buildHealth } from '../tools/graph.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const note = (fm, body = '') => {
  const lines = Object.entries(fm).map(([k, v]) =>
    Array.isArray(v) ? `${k}: [${v.join(', ')}]` : `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n${body}\n`;
};

test('tier1: migration debt — incoming link to a deprecated note', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/requirements/FR-001-old.md'),
      note({ id: 'FR-001', type: 'requirement', title: 'Old', status: 'deprecated',
             summary: 'old', priority: 'must', category: 'functional', superseded_by: 'FR-002' }));
    await writeFileDeep(join(dir, 'knowledge/product/requirements/FR-002-new.md'),
      note({ id: 'FR-002', type: 'requirement', title: 'New', status: 'draft',
             summary: 'new', priority: 'must', category: 'functional' }));
    await writeFileDeep(join(dir, 'knowledge/product/features/FEAT-001-x.md'),
      note({ id: 'FEAT-001', type: 'feature', title: 'X', status: 'draft',
             summary: 'x', links: ['FR-001'] }));
    const { markdown } = await buildHealth(dir, {});
    assert.match(markdown, /[Mm]igration debt/);
    assert.match(markdown, /FEAT-001/);
    assert.match(markdown, /FR-001/);
  } finally { await cleanup(dir); }
});

test('tier1: open questions/risks/assumptions (status != accepted)', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/Q-001-open.md'),
      note({ id: 'Q-001', type: 'question', title: 'Open?', status: 'draft', summary: 'q' }));
    await writeFileDeep(join(dir, 'knowledge/product/Q-002-done.md'),
      note({ id: 'Q-002', type: 'question', title: 'Done?', status: 'accepted', summary: 'q' }));
    const { markdown } = await buildHealth(dir, {});
    assert.match(markdown, /Q-001/);
    assert.ok(!markdown.includes('Q-002'), 'accepted question is not open');
  } finally { await cleanup(dir); }
});

test('tier1: empty topic node (no attached notes)', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/vision/TOP-001-vision.md'),
      note({ id: 'TOP-001', type: 'topic', title: 'Vision', status: 'draft', summary: 'v', parent: 'null' }));
    const { markdown } = await buildHealth(dir, {});
    assert.match(markdown, /[Ee]mpty topic/);
    assert.match(markdown, /TOP-001/);
  } finally { await cleanup(dir); }
});

test('tier2: orphan concrete note (no links, no backlinks)', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/ENT-001-lonely.md'),
      note({ id: 'ENT-001', type: 'entity', title: 'Lonely', status: 'draft', summary: 'e' }));
    const { markdown } = await buildHealth(dir, {});
    assert.match(markdown, /[Oo]rphan/);
    assert.match(markdown, /ENT-001/);
  } finally { await cleanup(dir); }
});

test('duplicates: off by default, on when enabled', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/users/PER-001-a.md'),
      note({ id: 'PER-001', type: 'persona', title: 'Busy parent', status: 'draft', summary: 'p' }));
    await writeFileDeep(join(dir, 'knowledge/users/PER-002-b.md'),
      note({ id: 'PER-002', type: 'persona', title: 'Busy parnt', status: 'draft', summary: 'p' }));
    const off = await buildHealth(dir, { duplicates: false });
    assert.ok(!/[Pp]ossible duplicate/.test(off.markdown));
    const on = await buildHealth(dir, { duplicates: true, threshold: 0.92 });
    assert.match(on.markdown, /[Pp]ossible duplicate/);
    assert.match(on.markdown, /PER-001/);
    assert.match(on.markdown, /PER-002/);
  } finally { await cleanup(dir); }
});

test('health.md has GENERATED banner and is exit-0 friendly (returns string)', async () => {
  const dir = await makeTmpDir();
  try {
    const { markdown } = await buildHealth(dir, {});
    assert.match(markdown, /GENERATED/);
  } finally { await cleanup(dir); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/graph.test.mjs`
Expected: FAIL — `Cannot find module '../tools/graph.mjs'`.

- [ ] **Step 3: Write `tools/graph.mjs`**

```javascript
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { walkMarkdown } from '../lib/walk.mjs';
import { readNote } from '../lib/note.mjs';
import { buildTree } from '../lib/mindmap.mjs';
import { jaroWinkler, normalizeForCompare } from '../lib/jaro-winkler.mjs';
import { loadConfig } from '../lib/config.mjs';

const BANNER = '<!-- GENERATED — do not edit by hand. Run: node tools/graph.mjs -->';

async function loadNotes(rootDir) {
  const files = await walkMarkdown(join(rootDir, 'knowledge'));
  const notes = [];
  for (const fp of files) {
    try { notes.push(await readNote(fp)); } catch { /* validate reports parse errors */ }
  }
  return notes;
}

export async function buildHealth(rootDir, opts = {}) {
  const notes = await loadNotes(rootDir);
  const byId = new Map(notes.map(n => [n.frontmatter.id, n]).filter(([id]) => id));

  // backlinks: target -> [sources]
  const backlinks = new Map();
  for (const n of notes) {
    const src = n.frontmatter.id;
    if (!src) continue;
    for (const t of n.links) {
      if (!backlinks.has(t)) backlinks.set(t, []);
      backlinks.get(t).push(src);
    }
  }

  // Tier 1.1 migration debt: incoming link to a deprecated note
  const debt = [];
  for (const n of notes) {
    if (n.frontmatter.status !== 'deprecated') continue;
    const incoming = backlinks.get(n.frontmatter.id) ?? [];
    if (incoming.length) debt.push({ deprecated: n.frontmatter.id, from: [...new Set(incoming)].sort() });
  }
  debt.sort((a, b) => a.deprecated.localeCompare(b.deprecated));

  // Tier 1.2 open Q/RISK/ASMP
  const openTypes = new Set(['question', 'risk', 'assumption']);
  const open = notes
    .filter(n => openTypes.has(n.frontmatter.type) && n.frontmatter.status !== 'accepted')
    .map(n => n.frontmatter.id).filter(Boolean).sort();

  // Tier 1.3 empty topic nodes (topic with no attached concrete notes and no children)
  const { roots } = buildTree(notes);
  const emptyTopics = [];
  const walkTopic = (node) => {
    if (node.notes.length === 0 && node.children.length === 0) emptyTopics.push(node.id);
    node.children.forEach(walkTopic);
  };
  roots.forEach(walkTopic);
  emptyTopics.sort();

  // Tier 2.1 orphans: concrete notes with no links and no backlinks
  const orphans = notes.filter(n => {
    const fm = n.frontmatter;
    if (fm.type === 'topic' || !fm.id) return false;
    const hasOut = n.links.length > 0;
    const hasIn = (backlinks.get(fm.id) ?? []).length > 0;
    return !hasOut && !hasIn;
  }).map(n => n.frontmatter.id).sort();

  // Tier 2.2 possible duplicates (opt-in)
  const dupes = [];
  if (opts.duplicates) {
    const threshold = opts.threshold ?? 0.92;
    const byType = new Map();
    for (const n of notes) {
      if (!n.frontmatter.id || n.frontmatter.type === 'topic') continue;
      const t = n.frontmatter.type;
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t).push(n);
    }
    for (const list of byType.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = normalizeForCompare(list[i].frontmatter.title);
          const b = normalizeForCompare(list[j].frontmatter.title);
          const score = jaroWinkler(a, b);
          if (score >= threshold) {
            dupes.push({ a: list[i].frontmatter.id, b: list[j].frontmatter.id, score: score.toFixed(3) });
          }
        }
      }
    }
    dupes.sort((x, y) => Number(y.score) - Number(x.score));
  }

  // render
  let md = `${BANNER}\n\n# Health report\n\n`;
  md += `## Tier 1 — actionable\n\n`;
  md += `### Migration debt (links to deprecated notes)\n`;
  md += debt.length ? debt.map(d => `- ${d.deprecated} ← ${d.from.join(', ')}`).join('\n') + '\n' : '_none_\n';
  md += `\n### Open questions / risks / assumptions\n`;
  md += open.length ? open.map(id => `- ${id}`).join('\n') + '\n' : '_none_\n';
  md += `\n### Empty topic nodes (no attached notes)\n`;
  md += emptyTopics.length ? emptyTopics.map(id => `- ${id}`).join('\n') + '\n' : '_none_\n';
  md += `\n## Tier 2 — may need attention (heuristic)\n\n`;
  md += `### Orphan notes (no links in or out)\n`;
  md += orphans.length ? orphans.map(id => `- ${id}`).join('\n') + '\n' : '_none_\n';
  if (opts.duplicates) {
    md += `\n### Possible duplicates (Jaro-Winkler ≥ ${opts.threshold ?? 0.92})\n`;
    md += dupes.length ? dupes.map(d => `- ${d.a} ~ ${d.b} (${d.score})`).join('\n') + '\n' : '_none_\n';
  }
  return { markdown: md };
}

export async function writeHealth(rootDir, opts = {}) {
  const { markdown } = await buildHealth(rootDir, opts);
  await mkdir(join(rootDir, 'index'), { recursive: true });
  await writeFile(join(rootDir, 'index', 'health.md'), markdown, 'utf8');
  return 'index/health.md';
}

// CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const cfg = await loadConfig(root);
  const cliDup = process.argv.includes('--duplicates');
  const opts = {
    duplicates: cliDup || cfg.health.duplicates.enabled,
    threshold: cfg.health.duplicates.threshold,
  };
  const out = await writeHealth(root, opts);
  console.log(`✓ generated ${out}`);
  process.exit(0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/graph.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Verify the CLI runs clean and exits 0**

Run: `node tools/graph.mjs; echo "exit=$?"`
Expected: prints `✓ generated index/health.md` and `exit=0`.

- [ ] **Step 6: Commit**

```bash
git add tools/graph.mjs test/graph.test.mjs
git commit -m "feat: add health report generator (graph.mjs)"
```

---

### Task 4: `tools/impact.mjs` — blast radius

**Files:**
- Create: `tools/impact.mjs`
- Test: `test/impact.test.mjs`

Pure `computeImpact(id, notes, depth)` → `{ incoming, outgoing }` (arrays of ids reachable within `depth` hops), plus a CLI. `incoming` = who links to id (and transitively); `outgoing` = what id links to.

- [ ] **Step 1: Write the failing test**

`test/impact.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeImpact } from '../tools/impact.mjs';

const note = (id, links = []) => ({ frontmatter: { id }, links });

const NOTES = [
  note('A', ['B']),       // A → B
  note('B', ['C']),       // B → C
  note('C', []),
  note('X', ['B']),       // X → B
];

test('depth 1: direct incoming and outgoing of B', () => {
  const { incoming, outgoing } = computeImpact('B', NOTES, 1);
  assert.deepEqual(incoming.sort(), ['A', 'X']);
  assert.deepEqual(outgoing.sort(), ['C']);
});

test('depth 2: transitive incoming of C includes A and X via B', () => {
  const { incoming } = computeImpact('C', NOTES, 2);
  assert.deepEqual(incoming.sort(), ['A', 'B', 'X']);
});

test('does not include the id itself', () => {
  const { incoming, outgoing } = computeImpact('B', NOTES, 2);
  assert.ok(!incoming.includes('B'));
  assert.ok(!outgoing.includes('B'));
});

test('tolerates a cycle without infinite loop', () => {
  const cyc = [note('P', ['Q']), note('Q', ['P'])];
  const { incoming, outgoing } = computeImpact('P', cyc, 5);
  assert.deepEqual(incoming, ['Q']);
  assert.deepEqual(outgoing, ['Q']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/impact.test.mjs`
Expected: FAIL — `Cannot find module '../tools/impact.mjs'`.

- [ ] **Step 3: Write `tools/impact.mjs`**

```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/impact.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/impact.mjs test/impact.test.mjs
git commit -m "feat: add impact (blast radius) tool"
```

---

### Task 5: pre-commit hook + install-hooks + npm scripts

**Files:**
- Create: `tools/hooks/pre-commit`
- Create: `tools/install-hooks.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create `tools/hooks/pre-commit`** (POSIX sh; runs under Git Bash on Windows)

```sh
#!/bin/sh
# Pre-commit guard for the knowledge base.
# validate = hard gate; reindex + graph = informational (never block).
set -e

echo "[pre-commit] validating notes..."
node tools/validate.mjs

echo "[pre-commit] regenerating indexes..."
node tools/reindex.mjs
git add index/MAP.md index/backlinks.json index/mindmap.md 2>/dev/null || true
git add index/*.index.md 2>/dev/null || true

echo "[pre-commit] regenerating health report..."
node tools/graph.mjs || true
git add index/health.md 2>/dev/null || true

echo "[pre-commit] ok"
```

- [ ] **Step 2: Create `tools/install-hooks.mjs`**

```javascript
import { copyFile, chmod, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = join(root, 'tools', 'hooks', 'pre-commit');
const destDir = join(root, '.git', 'hooks');
const dest = join(destDir, 'pre-commit');

await mkdir(destDir, { recursive: true });
await copyFile(src, dest);
try { await chmod(dest, 0o755); } catch { /* chmod is a no-op / may fail on Windows; fine */ }
console.log(`✓ installed pre-commit hook → ${dest}`);
```

- [ ] **Step 3: Add npm scripts to `package.json`**

In the `scripts` block, after the `mindmap` line, add:

```json
    "graph": "node tools/graph.mjs",
    "impact": "node tools/impact.mjs",
    "install-hooks": "node tools/install-hooks.mjs",
```

- [ ] **Step 4: Install and verify the hook works**

Run: `npm run install-hooks`
Expected: prints `✓ installed pre-commit hook → ...`.

Then verify it runs (dry, on the current clean tree):
Run: `sh tools/hooks/pre-commit`
Expected: prints the `[pre-commit]` lines ending with `[pre-commit] ok`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/hooks/pre-commit tools/install-hooks.mjs package.json
git commit -m "feat: add pre-commit hook and install-hooks script"
```

---

### Task 6: `lib/heal.mjs` — `healNote()` rule_set A–E

**Files:**
- Create: `lib/heal.mjs`
- Test: `test/heal.test.mjs`

`healNote({frontmatter, body}, ctx)` returns `{frontmatter, body}` reconstructed to a healthy state. `ctx = { existing, supersededIndex, today }` where `supersededIndex` is a `Map(deprecatedId → supersededById)` used for transitive resolution. Throws on rule_set B violations (missing required fields). Pure (no I/O).

- [ ] **Step 1: Write the failing test**

`test/heal.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healNote, resolveSupersede, slugify } from '../lib/heal.mjs';

const base = {
  frontmatter: { id: 'FR-007', type: 'requirement', title: 'Create monthly budget',
    status: 'draft', summary: 'S', priority: 'must', category: 'functional' },
  body: 'Body.',
};
const ctx = () => ({ existing: null, supersededIndex: new Map(), today: '2026-05-30' });

test('A: id is preserved, slug derives from title', () => {
  const { frontmatter } = healNote(base, ctx());
  assert.equal(frontmatter.id, 'FR-007');
  assert.equal(slugify('Create monthly budget'), 'create-monthly-budget');
});

test('B: missing required field throws', () => {
  const bad = { frontmatter: { id: 'FR-008', type: 'requirement' }, body: '' };
  assert.throws(() => healNote(bad, ctx()), /required|missing/i);
});

test('B: updated set to today; created preserved from existing', () => {
  const c = { ...ctx(), existing: { frontmatter: { ...base.frontmatter, created: '2026-01-01' } } };
  const { frontmatter } = healNote(base, c);
  assert.equal(frontmatter.updated, '2026-05-30');
  assert.equal(frontmatter.created, '2026-01-01');
});

test('B: created defaults to today on first write', () => {
  const { frontmatter } = healNote(base, ctx());
  assert.equal(frontmatter.created, '2026-05-30');
});

test('C7: transitive supersede resolution to live head', () => {
  const idx = new Map([['AB-1', 'CD-2'], ['CD-2', 'EF-3']]);
  assert.equal(resolveSupersede('AB-1', idx), 'EF-3');
});

test('C7: cyclic supersede chain returns input, does not loop', () => {
  const idx = new Map([['P', 'Q'], ['Q', 'P']]);
  assert.equal(resolveSupersede('P', idx), 'P');
});

test('C7: links healed from deprecated to live head', () => {
  const withLink = { ...base, frontmatter: { ...base.frontmatter, links: ['AB-1'] } };
  const c = { ...ctx(), supersededIndex: new Map([['AB-1', 'CD-2']]) };
  const { frontmatter } = healNote(withLink, c);
  assert.deepEqual(frontmatter.links, ['CD-2']);
});

test('C8: links deduplicated preserving first-seen order', () => {
  const dup = { ...base, frontmatter: { ...base.frontmatter, links: ['JTBD-1', 'JTBD-2', 'JTBD-1'] } };
  const { frontmatter } = healNote(dup, ctx());
  assert.deepEqual(frontmatter.links, ['JTBD-1', 'JTBD-2']);
});

test('C9: self-reference removed from links', () => {
  const selfRef = { ...base, frontmatter: { ...base.frontmatter, links: ['FR-007', 'JTBD-1'] } };
  const { frontmatter } = healNote(selfRef, ctx());
  assert.deepEqual(frontmatter.links, ['JTBD-1']);
});

test('D: unknown frontmatter fields and body preserved verbatim', () => {
  const extra = { frontmatter: { ...base.frontmatter, customField: 'keep-me', tags: ['a'] }, body: 'Rich body [[JTBD-1]]' };
  const { frontmatter, body } = healNote(extra, ctx());
  assert.equal(frontmatter.customField, 'keep-me');
  assert.deepEqual(frontmatter.tags, ['a']);
  assert.equal(body, 'Rich body [[JTBD-1]]');
});

test('B6: frontmatter key order is deterministic (id first, updated near id block)', () => {
  const { frontmatter } = healNote(base, ctx());
  const keys = Object.keys(frontmatter);
  assert.equal(keys[0], 'id');
  assert.ok(keys.indexOf('type') < keys.indexOf('summary'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/heal.test.mjs`
Expected: FAIL — `Cannot find module '../lib/heal.mjs'`.

- [ ] **Step 3: Write `lib/heal.mjs`**

```javascript
// healNote: reconstruct a note to a healthy state (rule_set A–E). Pure.

const REQUIRED_BASE = ['id', 'type', 'title', 'status', 'summary'];
const REQUIRED_BY_TYPE = {
  requirement: ['priority', 'category'],
  nfr: ['priority', 'category'],
  topic: ['parent'],
};
const KEY_ORDER = ['id', 'type', 'title', 'status', 'summary', 'priority', 'category',
  'parent', 'topic', 'tags', 'links', 'created', 'updated', 'superseded_by'];

export function slugify(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Follow superseded_by chain to the live head; guard against cycles.
export function resolveSupersede(id, supersededIndex) {
  const seen = new Set();
  let cur = id;
  while (supersededIndex.has(cur)) {
    if (seen.has(cur)) return id; // cycle → give up, return original
    seen.add(cur);
    cur = supersededIndex.get(cur);
  }
  return cur;
}

function orderKeys(fm) {
  const out = {};
  for (const k of KEY_ORDER) if (k in fm) out[k] = fm[k];
  for (const k of Object.keys(fm)) if (!(k in out)) out[k] = fm[k]; // unknown keys preserved, after known
  return out;
}

export function healNote(note, ctx) {
  const { existing, supersededIndex = new Map(), today } = ctx;
  const fm = { ...note.frontmatter };
  const body = note.body ?? '';

  // B3: required fields
  const required = [...REQUIRED_BASE, ...(REQUIRED_BY_TYPE[fm.type] ?? [])];
  for (const k of required) {
    if (fm[k] === undefined || fm[k] === null || fm[k] === '') {
      throw new Error(`heal: missing required field "${k}" for type ${fm.type}`);
    }
  }

  // A1: id preserved from existing if present
  if (existing?.frontmatter?.id) fm.id = existing.frontmatter.id;

  // B5: status default
  if (!fm.status) fm.status = 'draft';

  // B4: created once, updated every write
  fm.created = existing?.frontmatter?.created ?? fm.created ?? today;
  fm.updated = today;

  // C7: heal link/parent/topic references to live head
  const healRef = (v) => (typeof v === 'string' ? resolveSupersede(v, supersededIndex) : v);
  if (Array.isArray(fm.links)) {
    const healed = fm.links.map(healRef)
      .filter(t => t !== fm.id);          // C9 self-ref removed
    fm.links = [...new Set(healed)];      // C8 dedupe, preserve order
  }
  if (typeof fm.parent === 'string') fm.parent = healRef(fm.parent);
  if (typeof fm.topic === 'string') fm.topic = healRef(fm.topic);

  // B6 + D: deterministic key order, unknown fields preserved
  return { frontmatter: orderKeys(fm), body };
}
```

Note on rule C7-in-body inline `[[ID]]`: heal operates on frontmatter refs; inline body links are left to `kb-sanitize`/manual edits (body is preserved verbatim per rule D). This keeps `heal` pure and body-safe; document in the skill.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/heal.test.mjs`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/heal.mjs test/heal.test.mjs
git commit -m "feat: add healNote rule_set (reconstruct-to-healthy)"
```

---

### Task 7: `tools/write-note.mjs` — atomic write

**Files:**
- Create: `tools/write-note.mjs`
- Test: `test/write-note.test.mjs`

`writeNote(rootDir, targetРath, intent)` — orchestrates: load context (existing note if any, build `supersededIndex` from all notes), call `healNote`, write to a temp file in the same dir, locally validate (parse + schema for the type), atomically rename over target with retry on EPERM/EBUSY, return `{ path, created }`. On local-validate failure: delete temp, throw, target untouched.

- [ ] **Step 1: Write the failing test**

`test/write-note.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { writeNote, buildSupersededIndex } from '../tools/write-note.mjs';
import { readNote } from '../lib/note.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const intent = (over = {}) => ({
  frontmatter: { id: 'FR-007', type: 'requirement', title: 'Create budget',
    status: 'draft', summary: 'S', priority: 'must', category: 'functional', ...over },
  body: 'Body.',
});

test('create: writes a new healthy note at target', async () => {
  const dir = await makeTmpDir();
  try {
    const target = join(dir, 'knowledge/product/requirements/FR-007-create-budget.md');
    const res = await writeNote(dir, target, intent());
    assert.equal(res.created, true);
    const note = await readNote(target);
    assert.equal(note.frontmatter.id, 'FR-007');
    assert.equal(note.frontmatter.updated, note.frontmatter.created); // first write
  } finally { await cleanup(dir); }
});

test('update: overwrites target, preserves created', async () => {
  const dir = await makeTmpDir();
  try {
    const target = join(dir, 'knowledge/product/requirements/FR-007-x.md');
    await writeFileDeep(target,
      `---\nid: FR-007\ntype: requirement\ntitle: Old\nstatus: draft\nsummary: S\npriority: must\ncategory: functional\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\nOld.\n`);
    const res = await writeNote(dir, target, intent({ title: 'New title' }));
    assert.equal(res.created, false);
    const note = await readNote(target);
    assert.equal(note.frontmatter.title, 'New title');
    assert.equal(note.frontmatter.created, '2026-01-01'); // preserved
  } finally { await cleanup(dir); }
});

test('local-validate failure: target untouched, no temp left behind', async () => {
  const dir = await makeTmpDir();
  try {
    const target = join(dir, 'knowledge/product/requirements/FR-007-x.md');
    await writeFileDeep(target,
      `---\nid: FR-007\ntype: requirement\ntitle: Keep\nstatus: draft\nsummary: S\npriority: must\ncategory: functional\n---\nKeep.\n`);
    // invalid: priority not in enum → schema rejects
    await assert.rejects(() => writeNote(dir, target, intent({ priority: 'urgent' })));
    const note = await readNote(target);
    assert.equal(note.frontmatter.title, 'Keep'); // untouched
    const dirFiles = await readdir(join(dir, 'knowledge/product/requirements'));
    assert.ok(!dirFiles.some(f => f.includes('.tmp')), 'no temp file remains');
  } finally { await cleanup(dir); }
});

test('buildSupersededIndex maps deprecated id → superseded_by', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/requirements/FR-001-old.md'),
      `---\nid: FR-001\ntype: requirement\ntitle: Old\nstatus: deprecated\nsummary: S\npriority: must\ncategory: functional\nsuperseded_by: FR-002\n---\n`);
    const idx = await buildSupersededIndex(dir);
    assert.equal(idx.get('FR-001'), 'FR-002');
  } finally { await cleanup(dir); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/write-note.test.mjs`
Expected: FAIL — `Cannot find module '../tools/write-note.mjs'`.

- [ ] **Step 3: Write `tools/write-note.mjs`**

```javascript
import { join, dirname, basename } from 'node:path';
import { writeFile, rename, unlink, mkdir, access } from 'node:fs/promises';
import matter from 'gray-matter';
import { walkMarkdown } from '../lib/walk.mjs';
import { readNote } from '../lib/note.mjs';
import { healNote, slugify } from '../lib/heal.mjs';
import { loadValidators } from '../lib/schemas.mjs';

function todayISO(ctxToday) {
  // today must be injected (Date.now is unavailable in some contexts); fall back.
  return ctxToday ?? new Date().toISOString().slice(0, 10);
}

export async function buildSupersededIndex(rootDir) {
  const files = await walkMarkdown(join(rootDir, 'knowledge'));
  const idx = new Map();
  for (const fp of files) {
    let n;
    try { n = await readNote(fp); } catch { continue; }
    const fm = n.frontmatter;
    if (fm.status === 'deprecated' && fm.id && fm.superseded_by) {
      idx.set(fm.id, fm.superseded_by);
    }
  }
  return idx;
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

function serialize(frontmatter, body) {
  // gray-matter stringify keeps key insertion order (healNote already ordered them)
  return matter.stringify(body ?? '', frontmatter);
}

async function atomicRename(tmp, target, retries = 5) {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, target);
      return;
    } catch (e) {
      if ((e.code === 'EPERM' || e.code === 'EBUSY') && attempt < retries) {
        await new Promise(r => setTimeout(r, 50 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}

export async function writeNote(rootDir, targetPath, intent, opts = {}) {
  const today = todayISO(opts.today);
  const dir = dirname(targetPath);
  await mkdir(dir, { recursive: true });

  const existed = await exists(targetPath);
  const existing = existed ? await readNote(targetPath) : null;
  const supersededIndex = await buildSupersededIndex(rootDir);

  // 1. reconstruct to healthy
  const healed = healNote(intent, { existing, supersededIndex, today });

  // 2. write temp in same dir
  const nonce = `${process.pid}-${attemptCounter()}`;
  const tmp = join(dir, `.${healed.frontmatter.id}.${nonce}.tmp`);
  await writeFile(tmp, serialize(healed.frontmatter, healed.body), 'utf8');

  // 3. local validate (parse + schema for this type)
  try {
    const { validatorFor } = await loadValidators();
    const reparsed = matter(await (await import('node:fs/promises')).readFile(tmp, 'utf8'));
    const validate = validatorFor(reparsed.data.type);
    if (!validate(reparsed.data)) {
      const detail = (validate.errors ?? []).map(e => `${e.instancePath || '/'} ${e.message}`).join('; ');
      throw new Error(`write-note: local validation failed for ${healed.frontmatter.id} — ${detail}`);
    }
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }

  // 4. atomic rename (with Windows retry)
  await atomicRename(tmp, targetPath);

  return { path: targetPath, created: !existed };
}

let _c = 0;
function attemptCounter() { return (_c = (_c + 1) % 1e6); }

export function targetPathFor(rootDir, domainDir, id, title) {
  return join(rootDir, 'knowledge', domainDir, `${id}-${slugify(title)}.md`);
}
```

Note: `attemptCounter()` avoids `Math.random()` (unavailable in some sandboxes); `pid + counter` is unique enough for same-process temp names.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/write-note.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add tools/write-note.mjs test/write-note.test.mjs
git commit -m "feat: add atomic write-note pipeline"
```

---

### Task 8: Skill — `kb-evolve`

**Files:**
- Create: `.claude/skills/kb-evolve/SKILL.md`

- [ ] **Step 1: Create `.claude/skills/kb-evolve/SKILL.md`**

```markdown
---
name: kb-evolve
description: Use to change existing knowledge safely — rename, deprecate, merge, or split notes — without breaking the graph. Computes blast radius first; never reuses or deletes an id (tombstone via superseded_by).
---

# kb-evolve — safe evolution of notes

Goal: change already-captured knowledge without breaking links or violating the
stable-id invariant.

## Before any change with ripple
Run `node tools/impact.mjs <ID>` (optionally `--depth N`) and show the blast
radius (who links to this note, what it links to). Decide WITH the user.

## Operations

### rename-in-place — SAME id prefix (cosmetic)
The change stays within the same category (better slug / title / wording). Keep
the `id`; update title (and thus filename) by writing through the write pipeline
(`tools/write-note.mjs`). Backlinks untouched (they point at the id).

### tombstone migration — DIFFERENT id prefix (meaning changed)
`AB-123` should become `CD-xxx` (e.g. a requirement was really an NFR):
1. Create the new note with a fresh id via the write pipeline.
2. Mark the old note `status: deprecated` + `superseded_by: CD-xxx` (write pipeline).
3. Do NOT mass-rewrite backlinks. They remain valid (validate allows links to a
   deprecated note) and surface as Tier-1 "migration debt" in `index/health.md`.
   Debt heals passively (each note's next write reconstructs it to the live id)
   or in bulk via `kb-sanitize`.

### deprecate
Set `status: deprecated` (+ `superseded_by` if there is a successor) via the
write pipeline.

### merge
N notes → one target. The others become `deprecated` + `superseded_by: <target>`.
Move any unique content into the target first.

### split
One note → several. Original becomes `deprecated` + `superseded_by` (to the main
heir) OR is repurposed as an umbrella `topic` (judgment call). New notes get fresh ids.

## Invariants
- Never reuse or delete an id. Retire via `deprecated` + `superseded_by` (tombstone).
- All writes go through the write pipeline (`tools/write-note.mjs`) so the rule_set
  (heal) and atomic write apply. Never hand-edit notes for evolution.
- Never hand-edit `index/`. After writes, the Stop hook reindexes; `graph.mjs`
  refreshes `health.md` (or run `npm run graph`).

## Output (per mode)
- `debug`: show the blast radius, which notes changed, ids, and the resulting debt.
- `autonomous`: short human acknowledgement; hide ids/mechanics.
```

- [ ] **Step 2: Verify frontmatter parses**

Run: `node -e "import('gray-matter').then(m=>console.log(m.default(require('fs').readFileSync('.claude/skills/kb-evolve/SKILL.md','utf8')).data))"`
Expected: prints `{ name: 'kb-evolve', description: '...' }`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/kb-evolve/SKILL.md
git commit -m "feat: add kb-evolve skill"
```

---

### Task 9: Skill — `kb-sanitize`

**Files:**
- Create: `.claude/skills/kb-sanitize/SKILL.md`

- [ ] **Step 1: Create `.claude/skills/kb-sanitize/SKILL.md`**

```markdown
---
name: kb-sanitize
description: Use on request to clear accumulated migration debt — rewrite all references to deprecated notes onto their live superseding ids — in one isolated bulk commit, separate from logical changes.
---

# kb-sanitize — bulk debt migration

Goal: collect the migration debt (references still pointing at deprecated notes)
and resolve it in a single, isolated commit — keeping technical churn out of
logical-change commits.

## Steps
1. Read `index/health.md` (Tier-1 "migration debt") and/or scan notes for any
   `links` / `parent` / `topic` pointing at a `status: deprecated` note.
2. For each source note with debt, rewrite it through the write pipeline
   (`tools/write-note.mjs`). The heal rule_set resolves each reference to the
   LIVE head of the `superseded_by` chain (transitively, cycle-guarded), dedupes
   links, and removes self-references — automatically.
3. After all rewrites, run `npm run reindex` and `npm run graph` so indexes and
   `health.md` reflect zero (or reduced) debt.
4. Commit everything as ONE bulk commit:
   `chore(sanitize): migrate N deprecated references`.

## Rules
- This is the ONLY place bulk reference rewrites across many notes are allowed.
  Logical changes never do bulk ripple (that stays passive / per-note).
- Manual / on-request only (future: scheduled). Never auto-runs.
- All writes via the write pipeline; never hand-edit notes or `index/`.

## Output (per mode)
- `debug`: list each note rewritten and each reference migrated (old → live id).
- `autonomous`: short acknowledgement ("Прибрав технічний борг.").
```

- [ ] **Step 2: Verify frontmatter parses**

Run: `node -e "import('gray-matter').then(m=>console.log(m.default(require('fs').readFileSync('.claude/skills/kb-sanitize/SKILL.md','utf8')).data))"`
Expected: prints `{ name: 'kb-sanitize', description: '...' }`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/kb-sanitize/SKILL.md
git commit -m "feat: add kb-sanitize skill"
```

---

### Task 10: Update `kb-capture`, `CLAUDE.md`, `STATE.md`

**Files:**
- Modify: `.claude/skills/kb-capture/SKILL.md`
- Modify: `CLAUDE.md`
- Modify: `STATE.md`

- [ ] **Step 1: Update `.claude/skills/kb-capture/SKILL.md`** — Step 3 (WRITE) now goes through the write pipeline. Replace the `## Step 3 — WRITE` section body with:

```markdown
## Step 3 — WRITE (through the write pipeline)
- Filename target: `knowledge/<domain>/<ID>-<slug>.md` (slug = kebab of title; the
  write pipeline derives it).
- Build the note "intent" (frontmatter required fields: `id, type, title, status,
  summary` + `priority, category` for requirement/nfr; `parent` for topic; plus
  `links`, body). Set `status: draft` for new notes.
- Write via the atomic write pipeline `tools/write-note.mjs` (NOT a raw Write):
  it reconstructs the note to a healthy state (rule_set: sets `updated`, preserves
  `created`, resolves any deprecated refs to live ids, dedupes links, removes
  self-refs, keeps unknown fields verbatim) and writes atomically.
- Do NOT hand-edit `index/`.
```

- [ ] **Step 2: Add an evolution invariant to `CLAUDE.md`** — after the existing "Invariants" list, add these bullets:

```markdown
- All note writes go through the write pipeline (`tools/write-note.mjs` via
  `kb-capture`/`kb-evolve`); never raw-write or hand-edit notes. Every write
  reconstructs the note to a healthy state (rule_set in `lib/heal.mjs`).
- To retire a note, deprecate it (`status: deprecated` + `superseded_by`) — never
  reuse or delete an id. Same-prefix change = rename-in-place; different-prefix =
  tombstone migration (see `kb-evolve`).
```

- [ ] **Step 3: Extend the skills folder-map line in `CLAUDE.md`**

Replace:

```markdown
- `.claude/skills/` — kb-orient, kb-capture, kb-recall, kb-elicit, kb-visualize
```

with:

```markdown
- `.claude/skills/` — kb-orient, kb-capture, kb-recall, kb-elicit, kb-visualize, kb-evolve, kb-sanitize
```

- [ ] **Step 4: Add a Health/evolution note + tooling lines to `CLAUDE.md`** — after the "Mind-map (Phase 2a)" section, add:

```markdown
## Health & evolution (Phase 2b)
- `index/health.md` (GENERATED) reports actionable signals: migration debt, open
  `Q-`/`RISK-`/`ASMP-`, empty topic nodes; plus heuristic orphans (and opt-in
  duplicates via `kb.config.yml` `health.duplicates`). Regenerate: `npm run graph`.
- `npm run impact -- <ID>` shows a note's blast radius before evolving it.
- `npm run install-hooks` installs the git pre-commit guard (validate = gate;
  reindex + graph = informational).
- Evolve notes with **`kb-evolve`**; clear migration debt in bulk with **`kb-sanitize`**.
```

- [ ] **Step 5: Update `STATE.md`** — replace the `## Phase` body with:

```markdown
## Phase
Phase 2b complete (evolution & integrity). Health report, atomic write pipeline, and kb-evolve/kb-sanitize are available.
```

- [ ] **Step 6: Verify validation + reindex + graph still clean**

Run: `node tools/validate.mjs && node tools/reindex.mjs && node tools/graph.mjs`
Expected: `✓ knowledge base valid`; reindex success; `✓ generated index/health.md`.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/kb-capture/SKILL.md CLAUDE.md STATE.md
git commit -m "docs: route kb-capture through write pipeline; document Phase 2b"
```

---

### Task 11: End-to-end smoke verification

**Files:**
- Temporary notes under `knowledge/` (created then removed)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (Phase 1/2a 50 + all Phase 2b additions).

- [ ] **Step 2: Exercise the write pipeline + health for a real tombstone**

Create the supersede pair and a linker via Node (uses the real pipeline):

```bash
node --input-type=module -e "
import { writeNote } from './tools/write-note.mjs';
const root = process.cwd();
await writeNote(root, root + '/knowledge/product/requirements/FR-900-new.md', { frontmatter: { id:'FR-900', type:'requirement', title:'New budget rule', status:'draft', summary:'new', priority:'must', category:'functional' }, body:'B' }, { today:'2026-05-30' });
await writeNote(root, root + '/knowledge/product/requirements/FR-901-old.md', { frontmatter: { id:'FR-901', type:'requirement', title:'Old budget rule', status:'deprecated', summary:'old', priority:'must', category:'functional', superseded_by:'FR-900' }, body:'B' }, { today:'2026-05-30' });
await writeNote(root, root + '/knowledge/product/features/FEAT-900-x.md', { frontmatter: { id:'FEAT-900', type:'feature', title:'Linker', status:'draft', summary:'f', links:['FR-901'] }, body:'B' }, { today:'2026-05-30' });
console.log('seeded');
"
```

Expected: prints `seeded`; three files created.

- [ ] **Step 3: Confirm health shows the migration debt**

Run: `node tools/graph.mjs && node -e "const t=require('fs').readFileSync('index/health.md','utf8'); if(!/FEAT-900/.test(t)||!/FR-901/.test(t)) throw new Error('debt not reported'); console.log('OK: debt reported')"`
Expected: `✓ generated index/health.md` then `OK: debt reported`.

- [ ] **Step 4: Heal the debt passively by rewriting the linker through the pipeline**

```bash
node --input-type=module -e "
import { writeNote } from './tools/write-note.mjs';
import { readNote } from './lib/note.mjs';
const root = process.cwd();
const p = root + '/knowledge/product/features/FEAT-900-x.md';
const cur = await readNote(p);
await writeNote(root, p, { frontmatter: cur.frontmatter, body: cur.body }, { today:'2026-05-30' });
const after = await readNote(p);
if (!after.links.includes('FR-900') || after.links.includes('FR-901')) throw new Error('debt not healed: ' + after.links);
console.log('OK: link healed FR-901 -> FR-900');
"
```

Expected: `OK: link healed FR-901 -> FR-900`.

- [ ] **Step 5: Validate, then clean up the smoke notes**

Run: `node tools/validate.mjs`
Expected: `✓ knowledge base valid`.

Delete `knowledge/product/requirements/FR-900-new.md`, `knowledge/product/requirements/FR-901-old.md`, `knowledge/product/features/FEAT-900-x.md`. Then:
Run: `node tools/reindex.mjs && node tools/graph.mjs`
Expected: both regenerate against the now-clean tree; manually delete any now-stale per-domain index files (`index/product.index.md` etc. if their domains emptied), as in Phase 1/2a.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "test: end-to-end smoke of write pipeline + health report"
```

---

## Self-Review

**Spec coverage:**
- §2.1 health signals (Tier1: debt, open Q/RISK/ASMP, empty topics; Tier2: orphans, opt-in dupes) → Task 3 (`graph.mjs`), Task 2 (Jaro-Winkler). ✓
- §2.1 config-driven duplicates (`kb.config.yml`, nested defaults, CLI override) → Task 1 (config), Task 3 (graph reads cfg + `--duplicates`). ✓
- §2.2 pre-commit (validate gate + reindex + graph) + install-hooks → Task 5. ✓
- §3.1–3.2 reconstruct-to-healthy + rule_set A–E → Task 6 (`heal.mjs`). ✓
- §3.3 atomic write (temp same-dir → local validate → rename + Windows retry) → Task 7 (`write-note.mjs`). ✓
- §3.4 impact (depth 1 default, `--depth N`) → Task 4 (`impact.mjs`). ✓
- §3.5 `kb-evolve` (rename-in-place vs tombstone, deprecate/merge/split, impact-first, no mass ripple) → Task 8. ✓
- §3.6 `kb-sanitize` (bulk debt, one commit, transitive heal) → Task 9. ✓
- §4 CLAUDE.md/STATE.md/kb-capture-through-pipeline → Task 10. ✓
- §5 file structure → all tasks. §6 test strategy → tests in Tasks 1–7, smoke Task 11. ✓
- Q-2B decisions: dupes Jaro-Winkler≥0.92 opt-in (Tasks 2,3); impact depth (Task 4); npm scripts (Task 5); install-hooks (Task 5); config (Task 1). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command has expected output. ✓

**Type consistency:** `healNote(note, ctx)` → `{frontmatter, body}` (Tasks 6,7); `resolveSupersede(id, idx)`, `slugify(title)` (Tasks 6,7); `writeNote(rootDir, targetPath, intent, opts)` → `{path, created}` + `buildSupersededIndex(rootDir)` → Map (Tasks 7,11); `buildHealth(rootDir, opts)` → `{markdown}` + `writeHealth` (Tasks 3,5,11); `computeImpact(id, notes, depth)` → `{incoming, outgoing}` (Task 4); `jaroWinkler(a,b)`, `normalizeForCompare(s)` (Tasks 2,3); `loadConfig` → `{...,health:{duplicates:{enabled,threshold}}}` (Tasks 1,3). All consistent. ✓

**Known risk (flagged):** `write-note.mjs` Step-3 local validation re-reads the temp via dynamic `import('node:fs/promises')`; the implementer may simplify to a top-level `readFile` import (cleaner). Behavior unaffected. Also: gray-matter `matter.stringify` key order follows the object order set by `healNote` `orderKeys` — verify the smoke output has `id` first; if gray-matter reorders, add an explicit YAML dump option (documented in Task 7 note).
