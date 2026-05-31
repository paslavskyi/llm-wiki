# LLM-Wiki Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the minimum usable LLM-native knowledge system — folder tree, note schema validation, index generation, hooks, and the three core skills — so knowledge can start being captured reliably and session-free.

**Architecture:** Atomic Markdown notes with YAML frontmatter in `knowledge/`, validated against per-type JSON schemas. Node.js scripts (`validate.mjs`, `reindex.mjs`) enforce consistency and regenerate the `index/` routing layer. Claude hooks run validation on every write and reindex at end of turn. Three skills (`kb-orient`, `kb-capture`, `kb-recall`) encode the read/write/orient protocols.

**Tech Stack:** Node.js v24 (ESM, built-in `node:test`), `gray-matter` (frontmatter parsing), `ajv` (JSON-Schema validation), `js-yaml` (config). No build step.

**Scope:** Phase 1 only. Deferred to later plans: `graph.mjs`, `impact.mjs`, `session-delta.mjs`, `traceability.md`, `health.md`, pre-commit hook, `kb-evolve`, `kb-recap`, `kb-synthesize`, `elicit-requirements`, debug/autonomous modes. Phase 1 `reindex.mjs` generates `MAP.md`, per-domain indexes, and `backlinks.json` only.

**Spec:** `docs/superpowers/specs/2026-05-30-llm-wiki-knowledge-system-design.md`

---

## File Structure

```
package.json                       # deps + test script
.gitattributes                     # enforce LF for generated files
kb.config.yml                      # mode/language/owner
CLAUDE.md                          # session entry point
STATE.md                           # current-state snapshot
lib/
  walk.mjs                         # recursive *.md file walker
  note.mjs                         # read/parse a note + extract links
  schemas.mjs                      # load JSON schemas → ajv validators
  config.mjs                       # load kb.config.yml
  domain.mjs                       # map a note path → domain key
tools/
  validate.mjs                     # CLI: validate all notes (exit≠0 on error)
  reindex.mjs                      # CLI: regenerate index/*
  schema/
    base.json                      # common frontmatter schema
    requirement.json               # requirement/nfr typed schema (proven pattern)
    registry.json                  # type → schema-file map
test/
  walk.test.mjs
  note.test.mjs
  schemas.test.mjs
  config.test.mjs
  validate.test.mjs
  reindex.test.mjs
  helpers.mjs                      # tmp-dir fixture helpers
knowledge/                         # source notes (empty tree w/ .gitkeep)
index/                             # generated (empty w/ .gitkeep)
journal/                          # .gitkeep
docs/                             # already exists
.claude/
  settings.json                    # hooks
  skills/
    kb-orient/SKILL.md
    kb-capture/SKILL.md
    kb-recall/SKILL.md
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `.gitattributes`
- Create: `knowledge/.gitkeep`, `index/.gitkeep`, `journal/.gitkeep`
- Create: `knowledge/vision/.gitkeep`, `knowledge/market/.gitkeep`, `knowledge/users/.gitkeep`, `knowledge/product/features/.gitkeep`, `knowledge/product/requirements/.gitkeep`, `knowledge/product/stories/.gitkeep`, `knowledge/product/domain/.gitkeep`, `knowledge/roadmap/.gitkeep`, `knowledge/gtm/.gitkeep`, `knowledge/decisions/.gitkeep`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "llm-wiki",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "validate": "node tools/validate.mjs",
    "reindex": "node tools/reindex.mjs"
  },
  "dependencies": {
    "ajv": "^8.17.1",
    "gray-matter": "^4.0.3",
    "js-yaml": "^4.1.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` written, no errors.

- [ ] **Step 3: Create `.gitattributes`** (generated files use LF so diffs are stable)

```gitattributes
* text=auto eol=lf
*.md text eol=lf
*.json text eol=lf
*.mjs text eol=lf
*.yml text eol=lf
```

- [ ] **Step 4: Create the empty folder tree**

Create an empty file named `.gitkeep` at each of these paths:
`knowledge/.gitkeep`, `index/.gitkeep`, `journal/.gitkeep`, `knowledge/vision/.gitkeep`, `knowledge/market/.gitkeep`, `knowledge/users/.gitkeep`, `knowledge/product/features/.gitkeep`, `knowledge/product/requirements/.gitkeep`, `knowledge/product/stories/.gitkeep`, `knowledge/product/domain/.gitkeep`, `knowledge/roadmap/.gitkeep`, `knowledge/gtm/.gitkeep`, `knowledge/decisions/.gitkeep`

- [ ] **Step 5: Add `node_modules` to `.gitignore`**

Create `.gitignore`:

```gitignore
node_modules/
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitattributes .gitignore knowledge index journal
git commit -m "chore: scaffold knowledge repo (deps, folder tree)"
```

---

### Task 2: `lib/walk.mjs` — recursive markdown walker

**Files:**
- Create: `lib/walk.mjs`
- Test: `test/helpers.mjs`, `test/walk.test.mjs`

- [ ] **Step 1: Create the fixture helper**

`test/helpers.mjs`:

```javascript
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

export async function makeTmpDir() {
  return mkdtemp(join(tmpdir(), 'kbtest-'));
}

export async function writeFileDeep(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, 'utf8');
}

export async function cleanup(dir) {
  await rm(dir, { recursive: true, force: true });
}
```

- [ ] **Step 2: Write the failing test**

`test/walk.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { walkMarkdown } from '../lib/walk.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

test('walkMarkdown finds nested .md files, ignores others, sorted', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'a.md'), 'a');
    await writeFileDeep(join(dir, 'sub', 'b.md'), 'b');
    await writeFileDeep(join(dir, 'sub', 'note.txt'), 'ignored');
    const found = await walkMarkdown(dir);
    assert.deepEqual(found, [join(dir, 'a.md'), join(dir, 'sub', 'b.md')]);
  } finally {
    await cleanup(dir);
  }
});

test('walkMarkdown returns [] for a missing directory', async () => {
  const found = await walkMarkdown('/no/such/dir/xyz');
  assert.deepEqual(found, []);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/walk.test.mjs`
Expected: FAIL — `Cannot find module '../lib/walk.mjs'`.

- [ ] **Step 4: Write `lib/walk.mjs`**

```javascript
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function walkMarkdown(dir) {
  const out = [];
  async function recurse(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) await recurse(full);
      else if (e.isFile() && e.name.endsWith('.md')) out.push(full);
    }
  }
  await recurse(dir);
  return out.sort();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/walk.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/walk.mjs test/walk.test.mjs test/helpers.mjs
git commit -m "feat: add recursive markdown walker"
```

---

### Task 3: `lib/note.mjs` — parse a note and extract links

**Files:**
- Create: `lib/note.mjs`
- Test: `test/note.test.mjs`

- [ ] **Step 1: Write the failing test**

`test/note.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readNote, extractLinks } from '../lib/note.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

test('extractLinks merges frontmatter links and inline [[ID]], deduped', () => {
  const fm = { links: ['JTBD-002', 'FEAT-003'] };
  const body = 'see [[FEAT-003]] and [[NFR-005]] for details';
  assert.deepEqual(extractLinks(fm, body).sort(),
    ['FEAT-003', 'JTBD-002', 'NFR-005']);
});

test('extractLinks tolerates missing/empty links field', () => {
  assert.deepEqual(extractLinks({}, 'no links here'), []);
});

test('readNote parses frontmatter, body, and links', async () => {
  const dir = await makeTmpDir();
  try {
    const file = join(dir, 'FR-001-budget.md');
    await writeFileDeep(file,
      '---\nid: FR-001\ntype: requirement\nlinks: [JTBD-002]\n---\nBody [[FEAT-003]]\n');
    const note = await readNote(file);
    assert.equal(note.frontmatter.id, 'FR-001');
    assert.equal(note.fileName, 'FR-001-budget.md');
    assert.equal(note.body.trim(), 'Body [[FEAT-003]]');
    assert.deepEqual(note.links.sort(), ['FEAT-003', 'JTBD-002']);
  } finally {
    await cleanup(dir);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/note.test.mjs`
Expected: FAIL — `Cannot find module '../lib/note.mjs'`.

- [ ] **Step 3: Write `lib/note.mjs`**

```javascript
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import matter from 'gray-matter';

const LINK_RE = /\[\[([A-Z]+-[A-Za-z0-9-]+)\]\]/g;

export function extractLinks(frontmatter, body) {
  const set = new Set();
  if (Array.isArray(frontmatter.links)) {
    for (const l of frontmatter.links) {
      if (l) set.add(String(l));
    }
  }
  for (const m of body.matchAll(LINK_RE)) {
    set.add(m[1]);
  }
  return [...set];
}

export async function readNote(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const { data, content } = matter(raw);
  return {
    filePath,
    fileName: basename(filePath),
    frontmatter: data,
    body: content,
    links: extractLinks(data, content),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/note.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/note.mjs test/note.test.mjs
git commit -m "feat: add note parser and link extraction"
```

---

### Task 4: JSON schemas for note types

**Files:**
- Create: `tools/schema/base.json`
- Create: `tools/schema/requirement.json`
- Create: `tools/schema/registry.json`

- [ ] **Step 1: Create `tools/schema/base.json`** (every note must satisfy this)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "base",
  "type": "object",
  "required": ["id", "type", "title", "status", "summary"],
  "properties": {
    "id": { "type": "string", "pattern": "^[A-Z]+-[A-Za-z0-9-]+$" },
    "type": { "type": "string" },
    "title": { "type": "string", "minLength": 1 },
    "status": { "enum": ["draft", "proposed", "accepted", "deprecated"] },
    "summary": { "type": "string", "minLength": 1 },
    "tags": { "type": "array", "items": { "type": "string" } },
    "links": { "type": "array", "items": { "type": "string" } },
    "created": { "type": "string" },
    "updated": { "type": "string" },
    "superseded_by": { "type": ["string", "null"] }
  }
}
```

- [ ] **Step 2: Create `tools/schema/requirement.json`** (typed extension for `requirement` and `nfr`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "requirement",
  "type": "object",
  "required": ["id", "type", "title", "status", "summary", "priority", "category"],
  "properties": {
    "id": { "type": "string", "pattern": "^(FR|NFR)-[0-9]+$" },
    "type": { "enum": ["requirement", "nfr"] },
    "title": { "type": "string", "minLength": 1 },
    "status": { "enum": ["draft", "proposed", "accepted", "deprecated"] },
    "summary": { "type": "string", "minLength": 1 },
    "priority": { "enum": ["must", "should", "could", "wont"] },
    "category": { "enum": ["functional", "non-functional"] },
    "tags": { "type": "array", "items": { "type": "string" } },
    "links": { "type": "array", "items": { "type": "string" } },
    "created": { "type": "string" },
    "updated": { "type": "string" },
    "superseded_by": { "type": ["string", "null"] }
  }
}
```

- [ ] **Step 3: Create `tools/schema/registry.json`** (maps a note `type` to its typed schema file; types not listed validate against `base.json` only)

```json
{
  "requirement": "requirement.json",
  "nfr": "requirement.json"
}
```

- [ ] **Step 4: Commit**

```bash
git add tools/schema
git commit -m "feat: add base and requirement JSON schemas"
```

---

### Task 5: `lib/schemas.mjs` — schema loader

**Files:**
- Create: `lib/schemas.mjs`
- Test: `test/schemas.test.mjs`

- [ ] **Step 1: Write the failing test**

`test/schemas.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadValidators } from '../lib/schemas.mjs';

test('validatorFor returns the typed validator for requirement', async () => {
  const { validatorFor } = await loadValidators();
  const v = validatorFor('requirement');
  const ok = v({
    id: 'FR-001', type: 'requirement', title: 'T', status: 'draft',
    summary: 'S', priority: 'must', category: 'functional',
  });
  assert.equal(ok, true);
  const bad = v({
    id: 'FR-001', type: 'requirement', title: 'T', status: 'draft',
    summary: 'S', priority: 'urgent', category: 'functional',
  });
  assert.equal(bad, false);
});

test('validatorFor falls back to base for unregistered types', async () => {
  const { validatorFor } = await loadValidators();
  const v = validatorFor('vision');
  assert.equal(v({ id: 'VIS-001', type: 'vision', title: 'T',
    status: 'draft', summary: 'S' }), true);
  assert.equal(v({ id: 'VIS-001', type: 'vision' }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/schemas.test.mjs`
Expected: FAIL — `Cannot find module '../lib/schemas.mjs'`.

- [ ] **Step 3: Write `lib/schemas.mjs`**

```javascript
import Ajv from 'ajv';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(here, '..', 'tools', 'schema');

async function readJson(file) {
  return JSON.parse(await readFile(join(schemaDir, file), 'utf8'));
}

export async function loadValidators() {
  const ajv = new Ajv({ allErrors: true });
  const baseValidate = ajv.compile(await readJson('base.json'));
  const registry = await readJson('registry.json');
  const typed = {};
  for (const [type, file] of Object.entries(registry)) {
    typed[type] = ajv.compile(await readJson(file));
  }
  function validatorFor(type) {
    return typed[type] ?? baseValidate;
  }
  return { validatorFor, ajv };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/schemas.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/schemas.mjs test/schemas.test.mjs
git commit -m "feat: add schema loader with per-type validators"
```

---

### Task 6: `lib/domain.mjs` — path → domain key

**Files:**
- Create: `lib/domain.mjs`
- Test: add to `test/note.test.mjs`

- [ ] **Step 1: Write the failing test** (append to `test/note.test.mjs`)

```javascript
import { domainOf } from '../lib/domain.mjs';

test('domainOf returns top-level knowledge folder', () => {
  assert.equal(domainOf('knowledge/vision/VIS-001-x.md'), 'vision');
  assert.equal(domainOf('knowledge/product/requirements/FR-001-x.md'), 'product');
  assert.equal(domainOf('/abs/knowledge/gtm/POS-001-x.md'), 'gtm');
});

test('domainOf returns "unknown" when not under knowledge/', () => {
  assert.equal(domainOf('docs/foo.md'), 'unknown');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/note.test.mjs`
Expected: FAIL — `Cannot find module '../lib/domain.mjs'`.

- [ ] **Step 3: Write `lib/domain.mjs`**

```javascript
export function domainOf(filePath) {
  const norm = filePath.replaceAll('\\', '/');
  const idx = norm.indexOf('knowledge/');
  if (idx === -1) return 'unknown';
  const rest = norm.slice(idx + 'knowledge/'.length);
  const top = rest.split('/')[0];
  return top || 'unknown';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/note.test.mjs`
Expected: PASS (all note + domain tests).

- [ ] **Step 5: Commit**

```bash
git add lib/domain.mjs test/note.test.mjs
git commit -m "feat: add domain resolver"
```

---

### Task 7: `tools/validate.mjs` — validate all notes

**Files:**
- Create: `tools/validate.mjs`
- Test: `test/validate.test.mjs`

`validate.mjs` exposes a pure `validateNotes(rootDir)` returning `{ errors: string[] }`, plus a CLI wrapper that prints errors and sets exit code. Tests target the pure function.

- [ ] **Step 1: Write the failing test**

`test/validate.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { validateNotes } from '../tools/validate.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const GOOD = `---
id: FR-001
type: requirement
title: Create monthly budget
status: draft
summary: User can create a monthly budget.
priority: must
category: functional
links: [JTBD-001]
---
Body.
`;

const JTBD = `---
id: JTBD-001
type: jtbd
title: Track spending
status: draft
summary: As a user I want to track spending.
---
Body.
`;

test('clean knowledge base produces no errors', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/requirements/FR-001-budget.md'), GOOD);
    await writeFileDeep(join(dir, 'knowledge/users/JTBD-001-track.md'), JTBD);
    const { errors } = await validateNotes(dir);
    assert.deepEqual(errors, []);
  } finally {
    await cleanup(dir);
  }
});

test('schema violation is reported', async () => {
  const dir = await makeTmpDir();
  try {
    const bad = GOOD.replace('priority: must', 'priority: urgent');
    await writeFileDeep(join(dir, 'knowledge/product/requirements/FR-001-budget.md'), bad);
    const { errors } = await validateNotes(dir);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /FR-001/);
    assert.match(errors[0], /priority/);
  } finally {
    await cleanup(dir);
  }
});

test('duplicate id is reported', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/users/JTBD-001-a.md'), JTBD);
    await writeFileDeep(join(dir, 'knowledge/users/JTBD-001-b.md'), JTBD);
    const { errors } = await validateNotes(dir);
    assert.ok(errors.some(e => /duplicate id JTBD-001/i.test(e)));
  } finally {
    await cleanup(dir);
  }
});

test('dangling link is reported', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/requirements/FR-001-budget.md'), GOOD);
    // JTBD-001 referenced by FR-001 does not exist
    const { errors } = await validateNotes(dir);
    assert.ok(errors.some(e => /FR-001/.test(e) && /JTBD-001/.test(e)));
  } finally {
    await cleanup(dir);
  }
});

test('filename not matching id is reported', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/users/JTBD-999-track.md'), JTBD);
    const { errors } = await validateNotes(dir);
    assert.ok(errors.some(e => /filename/i.test(e) && /JTBD-001/.test(e)));
  } finally {
    await cleanup(dir);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/validate.test.mjs`
Expected: FAIL — `Cannot find module '../tools/validate.mjs'`.

- [ ] **Step 3: Write `tools/validate.mjs`**

```javascript
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkMarkdown } from '../lib/walk.mjs';
import { readNote } from '../lib/note.mjs';
import { loadValidators } from '../lib/schemas.mjs';

export async function validateNotes(rootDir) {
  const errors = [];
  const { validatorFor } = await loadValidators();
  const files = await walkMarkdown(join(rootDir, 'knowledge'));

  const notes = [];
  for (const file of files) {
    const note = await readNote(file);
    notes.push(note);
  }

  // 1. schema + filename checks; collect ids
  const ids = new Map(); // id -> count
  for (const note of notes) {
    const fm = note.frontmatter;
    const id = fm.id;
    if (!id) {
      errors.push(`${note.fileName}: missing frontmatter "id"`);
      continue;
    }
    ids.set(id, (ids.get(id) ?? 0) + 1);

    const validate = validatorFor(fm.type);
    if (!validate(fm)) {
      const detail = (validate.errors ?? [])
        .map(e => `${e.instancePath || '/'} ${e.message}`)
        .join('; ');
      errors.push(`${id}: schema error — ${detail}`);
    }

    if (!note.fileName.startsWith(`${id}-`) && note.fileName !== `${id}.md`) {
      errors.push(`${id}: filename "${note.fileName}" must start with the id`);
    }
  }

  // 2. duplicate ids
  for (const [id, count] of ids) {
    if (count > 1) errors.push(`duplicate id ${id} (${count} files)`);
  }

  // 3. dangling links
  for (const note of notes) {
    for (const target of note.links) {
      if (!ids.has(target)) {
        errors.push(`${note.frontmatter.id ?? note.fileName}: dangling link → ${target}`);
      }
    }
  }

  return { errors };
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? process.cwd();
  const { errors } = await validateNotes(root);
  if (errors.length) {
    console.error(`✗ ${errors.length} validation error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('✓ knowledge base valid');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/validate.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify the CLI runs clean on the empty tree**

Run: `node tools/validate.mjs`
Expected: prints `✓ knowledge base valid`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add tools/validate.mjs test/validate.test.mjs
git commit -m "feat: add note validation (schema, dup ids, dangling links, filename)"
```

---

### Task 8: `tools/reindex.mjs` — generate MAP, per-domain indexes, backlinks

**Files:**
- Create: `tools/reindex.mjs`
- Test: `test/reindex.test.mjs`

`reindex.mjs` exposes a pure `buildIndexes(rootDir)` returning `{ files: {relPath: contents} }` (so tests assert on content without disk writes), plus `writeIndexes(rootDir)` and a CLI wrapper.

- [ ] **Step 1: Write the failing test**

`test/reindex.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { buildIndexes } from '../tools/reindex.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const FR = `---
id: FR-001
type: requirement
title: Create monthly budget
status: draft
summary: User can create a monthly budget.
priority: must
category: functional
links: [JTBD-001]
---
`;

const JTBD = `---
id: JTBD-001
type: jtbd
title: Track spending
status: accepted
summary: As a user I want to track spending.
---
`;

async function seed(dir) {
  await writeFileDeep(join(dir, 'knowledge/product/requirements/FR-001-budget.md'), FR);
  await writeFileDeep(join(dir, 'knowledge/users/JTBD-001-track.md'), JTBD);
}

test('MAP lists domains with note counts', async () => {
  const dir = await makeTmpDir();
  try {
    await seed(dir);
    const { files } = await buildIndexes(dir);
    const map = files['index/MAP.md'];
    assert.match(map, /GENERATED/);
    assert.match(map, /product/);
    assert.match(map, /users/);
  } finally {
    await cleanup(dir);
  }
});

test('per-domain index lists id, title, status, summary', async () => {
  const dir = await makeTmpDir();
  try {
    await seed(dir);
    const { files } = await buildIndexes(dir);
    const idx = files['index/users.index.md'];
    assert.match(idx, /JTBD-001/);
    assert.match(idx, /Track spending/);
    assert.match(idx, /accepted/);
    assert.match(idx, /track spending/i);
  } finally {
    await cleanup(dir);
  }
});

test('backlinks.json records reverse links', async () => {
  const dir = await makeTmpDir();
  try {
    await seed(dir);
    const { files } = await buildIndexes(dir);
    const backlinks = JSON.parse(files['index/backlinks.json']);
    assert.deepEqual(backlinks['JTBD-001'], ['FR-001']);
  } finally {
    await cleanup(dir);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/reindex.test.mjs`
Expected: FAIL — `Cannot find module '../tools/reindex.mjs'`.

- [ ] **Step 3: Write `tools/reindex.mjs`**

```javascript
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { walkMarkdown } from '../lib/walk.mjs';
import { readNote } from '../lib/note.mjs';
import { domainOf } from '../lib/domain.mjs';

const BANNER = '<!-- GENERATED — do not edit by hand. Run: npm run reindex -->';

export async function buildIndexes(rootDir) {
  const knowledgeDir = join(rootDir, 'knowledge');
  const filePaths = await walkMarkdown(knowledgeDir);

  const notes = [];
  for (const fp of filePaths) {
    const note = await readNote(fp);
    notes.push({ ...note, domain: domainOf(fp) });
  }

  // group by domain
  const byDomain = new Map();
  for (const n of notes) {
    if (!byDomain.has(n.domain)) byDomain.set(n.domain, []);
    byDomain.get(n.domain).push(n);
  }
  for (const list of byDomain.values()) {
    list.sort((a, b) => String(a.frontmatter.id).localeCompare(String(b.frontmatter.id)));
  }

  // backlinks
  const backlinks = {};
  for (const n of notes) {
    for (const target of n.links) {
      (backlinks[target] ??= []).push(n.frontmatter.id);
    }
  }
  for (const k of Object.keys(backlinks)) {
    backlinks[k] = [...new Set(backlinks[k])].sort();
  }

  const files = {};

  // MAP.md
  const domains = [...byDomain.keys()].sort();
  let map = `${BANNER}\n\n# Knowledge Map\n\nTotal notes: ${notes.length}\n\n`;
  map += `| Domain | Notes | Index |\n|---|---|---|\n`;
  for (const d of domains) {
    map += `| ${d} | ${byDomain.get(d).length} | [${d}](./${d}.index.md) |\n`;
  }
  map += `\nNavigation: read this MAP → open the relevant \`<domain>.index.md\` → open only the note files you need.\n`;
  files['index/MAP.md'] = map;

  // per-domain indexes
  for (const d of domains) {
    let idx = `${BANNER}\n\n# Index: ${d}\n\n`;
    idx += `| id | title | status | priority | summary |\n|---|---|---|---|---|\n`;
    for (const n of byDomain.get(d)) {
      const fm = n.frontmatter;
      const summary = String(fm.summary ?? '').replace(/\n/g, ' ').trim();
      idx += `| ${fm.id} | ${fm.title ?? ''} | ${fm.status ?? ''} | ${fm.priority ?? ''} | ${summary} |\n`;
    }
    files[`index/${d}.index.md`] = idx;
  }

  // backlinks.json (stable key order)
  const ordered = {};
  for (const k of Object.keys(backlinks).sort()) ordered[k] = backlinks[k];
  files['index/backlinks.json'] = JSON.stringify(ordered, null, 2) + '\n';

  return { files };
}

export async function writeIndexes(rootDir) {
  const { files } = await buildIndexes(rootDir);
  await mkdir(join(rootDir, 'index'), { recursive: true });
  for (const [rel, contents] of Object.entries(files)) {
    await writeFile(join(rootDir, rel), contents, 'utf8');
  }
  return Object.keys(files);
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? process.cwd();
  const written = await writeIndexes(root);
  console.log(`✓ regenerated ${written.length} index file(s)`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/reindex.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify CLI runs on the empty tree**

Run: `node tools/reindex.mjs`
Expected: prints `✓ regenerated 1 index file(s)` (MAP only, no domains yet), `index/MAP.md` created.

- [ ] **Step 6: Commit**

```bash
git add tools/reindex.mjs test/reindex.test.mjs index/MAP.md
git commit -m "feat: add index generation (MAP, per-domain, backlinks)"
```

---

### Task 9: `lib/config.mjs` + `kb.config.yml`

**Files:**
- Create: `kb.config.yml`
- Create: `lib/config.mjs`
- Test: `test/config.test.mjs`

- [ ] **Step 1: Create `kb.config.yml`**

```yaml
# Knowledge base runtime config. Read first in every session.
mode: debug          # debug | autonomous  (Phase 1: debug only; autonomous is Phase 2)
language: uk
owner: Andrii
```

- [ ] **Step 2: Write the failing test**

`test/config.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

test('loadConfig reads mode/language/owner', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'kb.config.yml'),
      'mode: autonomous\nlanguage: en\nowner: Sam\n');
    const cfg = await loadConfig(dir);
    assert.equal(cfg.mode, 'autonomous');
    assert.equal(cfg.language, 'en');
    assert.equal(cfg.owner, 'Sam');
  } finally {
    await cleanup(dir);
  }
});

test('loadConfig falls back to defaults when file missing', async () => {
  const dir = await makeTmpDir();
  try {
    const cfg = await loadConfig(dir);
    assert.equal(cfg.mode, 'debug');
    assert.equal(cfg.language, 'uk');
  } finally {
    await cleanup(dir);
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/config.test.mjs`
Expected: FAIL — `Cannot find module '../lib/config.mjs'`.

- [ ] **Step 4: Write `lib/config.mjs`**

```javascript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';

const DEFAULTS = { mode: 'debug', language: 'uk', owner: '' };

export async function loadConfig(rootDir) {
  try {
    const raw = await readFile(join(rootDir, 'kb.config.yml'), 'utf8');
    const parsed = yaml.load(raw) ?? {};
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/config.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add kb.config.yml lib/config.mjs test/config.test.mjs
git commit -m "feat: add kb.config.yml and config loader"
```

---

### Task 10: `.claude/settings.json` — hooks

**Files:**
- Create: `.claude/settings.json`

The PostToolUse hook validates after writes to `knowledge/`; the Stop hook reindexes. Both run from the repo root.

- [ ] **Step 1: Create `.claude/settings.json`**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node tools/validate.mjs"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node tools/reindex.mjs"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Verify hooks are valid JSON and commands run**

Run: `node tools/validate.mjs && node tools/reindex.mjs`
Expected: both succeed (validate prints valid, reindex regenerates).

- [ ] **Step 3: Commit**

```bash
git add .claude/settings.json
git commit -m "feat: add validate (PostToolUse) and reindex (Stop) hooks"
```

---

### Task 11: `STATE.md`

**Files:**
- Create: `STATE.md`

- [ ] **Step 1: Create `STATE.md`**

```markdown
# STATE — current snapshot

> Read this first (after `kb.config.yml`) at the start of every session, then run the `kb-orient` skill.

## Phase
Phase 1 complete (infrastructure). Knowledge capture is open.

## Progress by domain
- [ ] vision
- [ ] market
- [ ] users
- [ ] product/features
- [ ] product/requirements
- [ ] product/stories
- [ ] product/domain
- [ ] roadmap
- [ ] gtm
- [ ] decisions

## Next step
Begin eliciting product knowledge, starting with `vision`. Capture each insight as an atomic note via the `kb-capture` skill.

## Open questions / assumptions / risks
- See `index/health.md` once Phase 2 lands. For now, track open items as `Q-*` / `ASMP-*` / `RISK-*` notes under the relevant domain.
```

- [ ] **Step 2: Commit**

```bash
git add STATE.md
git commit -m "docs: add STATE.md snapshot"
```

---

### Task 12: `CLAUDE.md` — session entry point

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create `CLAUDE.md`**

```markdown
# LLM-Wiki — LLM-native product knowledge base

This repository is a **knowledge system**, not product code. It captures and
systematizes everything known about the product so that specs, roadmap, KPIs,
and go-to-market can be built on top. The interface to this knowledge is an LLM.

## Three layers
1. **Knowledge** (`knowledge/`) — atomic Markdown notes with YAML frontmatter.
   The single source of truth. Written by humans / in dialogue.
2. **Indexes** (`index/`) — GENERATED routing layer. Never edit by hand.
3. **State** (`STATE.md`, `journal/`) — where we are + history between sessions.

## Session protocol (do this every session)
1. Read `kb.config.yml` — sets `mode` (debug/autonomous) and `language`.
2. Run the **`kb-orient`** skill — reads `STATE.md` + `index/MAP.md` to learn
   where we are and what's next. Do NOT read the whole repo.
3. Capture knowledge ONLY through the **`kb-capture`** skill.
4. Retrieve knowledge through the **`kb-recall`** skill (index-first).

## Invariants (do not violate)
- Never edit files in `index/` or `docs/` by hand — they are generated.
- Never read the whole knowledge base — navigate index-first (MAP → domain index → note).
- Every note has a stable `id`; once assigned, an id is never reused or deleted.
- A note's filename must start with its `id` (e.g., `FR-001-budget.md`).
- Capture knowledge only via `kb-capture`; do not hand-write notes ad hoc.

## Type & ID vocabulary
| Domain | type | ID prefix |
|---|---|---|
| vision | vision, principle, value-prop | VIS- |
| market | competitor, market-insight | CMP-, MKT- |
| users | persona, segment, jtbd, pain | PER-, SEG-, JTBD-, PAIN- |
| product | feature, requirement, nfr, story, entity, term | FEAT-, FR-, NFR-, STORY-, ENT-, TERM- |
| roadmap | milestone, kpi | MIL-, KPI- |
| gtm | positioning, channel, pricing, message | POS-, CHAN-, PRICE-, MSG- |
| cross-cutting | risk, assumption, question | RISK-, ASMP-, Q- |

`requirement` priority values: `must | should | could | wont`.

## Folder map
- `knowledge/<domain>/...` — source notes
- `index/` — generated (MAP, per-domain indexes, backlinks.json)
- `tools/` — Node scripts: `validate.mjs`, `reindex.mjs`
- `.claude/skills/` — kb-orient, kb-capture, kb-recall

## Tooling
- `npm run validate` — validate all notes (also runs automatically after writes).
- `npm run reindex` — regenerate `index/` (also runs automatically at end of turn).
- `npm test` — run the tool test suite.

## Mode
`mode: debug` (default) — report reads/writes/changes explicitly.
`mode: autonomous` — short human acknowledgements only; hide wiki mechanics. (Phase 2.)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md session entry point"
```

---

### Task 13: Skill — `kb-orient`

**Files:**
- Create: `.claude/skills/kb-orient/SKILL.md`

- [ ] **Step 1: Create `.claude/skills/kb-orient/SKILL.md`**

```markdown
---
name: kb-orient
description: Use at the start of every session in this knowledge repo to learn where we are and what's next, before any other work. Reads STATE and the index map, never the whole repo.
---

# kb-orient — session bootstrap

Goal: in seconds, know the current phase, what's done, what's next, and open
questions — without loading the whole knowledge base.

## Steps
1. Read `kb.config.yml`. Note `mode` and `language`. Respond in `language`.
   - `debug`: report what you read and the full picture.
   - `autonomous`: give only a short human summary of where things stand.
2. Read `STATE.md` — current phase, progress checklist, next step, open items.
3. Read `index/MAP.md` — domains and note counts. Do NOT open individual notes yet.
4. If `index/health.md` exists (Phase 2+), read it for open questions/risks.
5. Produce an orientation summary:
   - Current phase and the single recommended next step.
   - Per-domain note counts (from MAP).
   - Any open questions/risks you saw.
6. Hand off: if the next step is knowledge capture, suggest running
   `elicit-requirements` (Phase 2) or proceed with `kb-capture` for a specific insight.

## Rules
- Never read the whole `knowledge/` tree here. Orientation is index-only.
- Do not modify any file in this skill.
```

- [ ] **Step 2: Verify frontmatter is parseable**

Run: `node -e "import('gray-matter').then(m=>console.log(m.default(require('fs').readFileSync('.claude/skills/kb-orient/SKILL.md','utf8')).data))"`
Expected: prints `{ name: 'kb-orient', description: '...' }`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/kb-orient/SKILL.md
git commit -m "feat: add kb-orient skill"
```

---

### Task 14: Skill — `kb-capture`

**Files:**
- Create: `.claude/skills/kb-capture/SKILL.md`

- [ ] **Step 1: Create `.claude/skills/kb-capture/SKILL.md`**

```markdown
---
name: kb-capture
description: Use to record a single piece of product knowledge as an atomic note in this repo — resolves whether to create new or update existing, assigns a stable id, writes valid frontmatter, and links it into the graph.
---

# kb-capture — write one atomic note

Goal: capture exactly one concept correctly, without creating duplicates.

## Step 1 — RESOLVE (always first)
Before writing, use the `kb-recall` skill to check whether this concept already exists:
- Same concept already noted → **update** that note.
- Related but distinct → **create** a new note and add a `links` entry to the related one.
- Nothing found → **create** a new note.
If the update would ripple to other notes (their meaning depends on this change),
stop and hand off to `kb-evolve` (Phase 2). For Phase 1, note the ripple in your
response and update only this note.

## Step 2 — IDENTIFY
- Pick the `type` from the vocabulary in `CLAUDE.md`.
- Choose the matching domain folder and ID prefix.
- Assign the next free id: read `index/<domain>.index.md` (or scan the folder) and
  take the highest existing number for that prefix, +1. Zero-pad to 3 digits
  (e.g., `FR-007`).

## Step 3 — WRITE
- Filename: `knowledge/<domain>/<ID>-<slug>.md` (slug = short kebab title).
- Frontmatter required fields: `id, type, title, status, summary`
  (+ `priority, category` for requirement/nfr). Set `status: draft`,
  `created`/`updated` to today's date, `links` to related ids.
- Body: the actual content / acceptance criteria. Inline links as `[[ID]]`.

## Step 4 — VERIFY
- The PostToolUse hook runs `node tools/validate.mjs` automatically. If it reports
  an error, fix the note until validation passes.
- Update `STATE.md` if the phase, next step, or an open question changed.

## Output (per mode)
- `debug`: state which note you created/updated, its id, and links added.
- `autonomous`: a short human acknowledgement (e.g., "Занотував.").

## Rules
- One concept per note. If you're writing two ideas, make two notes.
- Never reuse or delete an id. To retire a note, deprecate it (Phase 2 `kb-evolve`).
- Never hand-edit `index/`.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/kb-capture/SKILL.md
git commit -m "feat: add kb-capture skill"
```

---

### Task 15: Skill — `kb-recall`

**Files:**
- Create: `.claude/skills/kb-recall/SKILL.md`

- [ ] **Step 1: Create `.claude/skills/kb-recall/SKILL.md`**

```markdown
---
name: kb-recall
description: Use to find existing product knowledge in this repo before answering, deciding, or capturing — navigates index-first (MAP → domain index → specific notes) instead of reading everything.
---

# kb-recall — index-first retrieval

Goal: find the relevant notes for a question while reading as little as possible.

## Steps
1. Read `index/MAP.md` to pick the relevant domain(s) by note counts and names.
2. Open the relevant `index/<domain>.index.md`. Use the `summary` column to
   shortlist candidate ids — do NOT open notes yet.
3. Open only the shortlisted note files.
4. Follow `links` (and `index/backlinks.json` for reverse links) to pull in
   directly related notes — one hop unless the question needs more.
5. Report findings:
   - `debug`: list the ids you read and their statuses.
   - `autonomous`: summarize what's already known in plain language, no ids.

## Rules
- Never read the whole `knowledge/` tree. If the index can't answer it, widen the
  shortlist by one hop at a time.
- Recall is read-only. To write, hand off to `kb-capture`.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/kb-recall/SKILL.md
git commit -m "feat: add kb-recall skill"
```

---

### Task 16: End-to-end smoke verification

**Files:**
- Temporary: `knowledge/vision/VIS-001-smoke.md` (created then removed)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests across `test/*.test.mjs` PASS.

- [ ] **Step 2: Create a real seed note and validate the pipeline**

Create `knowledge/vision/VIS-001-smoke.md`:

```markdown
---
id: VIS-001
type: vision
title: Smoke test vision note
status: draft
summary: Temporary note to verify the validate+reindex pipeline end to end.
created: 2026-05-30
updated: 2026-05-30
---
Smoke test body.
```

- [ ] **Step 3: Validate and reindex**

Run: `node tools/validate.mjs && node tools/reindex.mjs`
Expected: `✓ knowledge base valid`, then `✓ regenerated 2 index file(s)` (MAP + vision). `index/vision.index.md` now lists `VIS-001`.

- [ ] **Step 4: Confirm the index content**

Run: `node -e "console.log(require('fs').readFileSync('index/vision.index.md','utf8'))"`
Expected: a table row containing `VIS-001` and `Smoke test vision note`.

- [ ] **Step 5: Remove the smoke note and reindex back to clean**

Delete `knowledge/vision/VIS-001-smoke.md`, then:
Run: `node tools/reindex.mjs`
Expected: `index/vision.index.md` removed or empty of VIS-001; MAP no longer lists vision.

Note: `reindex.mjs` overwrites `index/*` it generates but does not delete stale per-domain index files. After removing the only note in a domain, manually delete the now-stale `index/vision.index.md`. (Stale-index cleanup is automated in Phase 2.)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "test: end-to-end smoke verification of validate+reindex pipeline"
```

---

## Self-Review

**Spec coverage (Phase 1 scope):**
- Folder tree (spec §3) → Task 1. ✓
- Note anatomy + frontmatter (spec §4) → Tasks 3, 4. ✓
- Type/ID vocabulary (spec §4.1) → documented in `CLAUDE.md` (Task 12); enforced for requirement/nfr via schema (Task 4). Other types validate against base — consistent with spec §11 Q-DESIGN-001 deferral. ✓
- Priority `must/should/could/wont`, no framework name (spec §4.2) → `requirement.json` enum (Task 4). ✓
- `validate.mjs` (spec §5.1) → Task 7. ✓
- `reindex.mjs` MAP + per-domain + backlinks (spec §5.1, Phase 1 subset) → Task 8. ✓
- Hooks PostToolUse→validate, Stop→reindex (spec §5.2) → Task 10. ✓
- Skills kb-orient/kb-capture/kb-recall (spec §6, Phase 1 subset) → Tasks 13–15. ✓
- kb.config.yml + modes scaffold (spec §7) → Task 9; autonomous behavior described in skills, full implementation deferred to Phase 2 per spec §10. ✓
- STATE.md (spec §8) → Task 11. ✓
- CLAUDE.md entry point (spec §6) → Task 12. ✓
- Deferred (graph/impact/session-delta/traceability/health/pre-commit/kb-evolve/kb-recap/kb-synthesize/elicit-requirements) → explicitly out of scope, called out in plan header. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code; every command has expected output. ✓

**Type consistency:** `validateNotes(rootDir)` (Task 7) and `buildIndexes(rootDir)`/`writeIndexes(rootDir)` (Task 8) names are used consistently in tests and CLI. `loadValidators()` returns `{ validatorFor, ajv }`, used as `validatorFor(type)` in Task 7. `readNote` returns `{ filePath, fileName, frontmatter, body, links }`, consumed consistently in Tasks 7–8. `domainOf` (Task 6) used in Task 8. `extractLinks(frontmatter, body)` signature consistent. ✓
```
