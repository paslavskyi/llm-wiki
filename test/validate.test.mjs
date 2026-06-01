import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { validateNotes, checkStateScope } from '../tools/validate.mjs';
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

test('note with unquoted YAML dates validates with no errors', async () => {
  const dir = await makeTmpDir();
  try {
    // Unique summary so gray-matter's in-process content cache cannot
    // mask the Date-normalization behavior across runs.
    const unique = `nonce-${Date.now()}-${Math.random()}`;
    const note = `---
id: VIS-001
type: vision
title: Product vision
status: draft
summary: ${unique}
created: 2026-05-30
updated: 2026-05-30
---
Body.
`;
    await writeFileDeep(join(dir, 'knowledge/vision/VIS-001-vision.md'), note);
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
    assert.ok(errors.some(e => /FR-001/.test(e) && /priority/.test(e) && /schema/.test(e)));
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

test('malformed frontmatter is reported, not thrown', async () => {
  const dir = await makeTmpDir();
  try {
    // Genuinely malformed YAML. Made unique per run so gray-matter's
    // in-process content cache cannot mask the parse throw.
    const unique = `nonce-${Date.now()}-${Math.random()}`;
    const broken = `---\nid: FR-001\n  : broken: : : ${unique}\n---\nBody.\n`;
    await writeFileDeep(join(dir, 'knowledge/product/requirements/FR-001-budget.md'), broken);
    const { errors } = await validateNotes(dir);
    assert.ok(errors.length > 0, 'expected at least one error');
    assert.ok(
      errors.some(e => /FR-001-budget\.md/.test(e) && /invalid frontmatter/i.test(e)),
      `expected an error mentioning the filename and "invalid frontmatter", got: ${JSON.stringify(errors)}`,
    );
  } finally {
    await cleanup(dir);
  }
});

test('duplicate top-level frontmatter key is reported (raw scan)', async () => {
  // Bug 2 (defense in depth): gray-matter/js-yaml keep the LAST of a duplicated
  // key on parse, so the corruption is invisible to the parsed object. validate
  // must scan the RAW `---`…`---` block. Two `title:` lines => an error.
  const dir = await makeTmpDir();
  try {
    const dup = `---\nid: FR-001\ntype: requirement\ntitle: First\ntitle: Second\nstatus: draft\nsummary: S\npriority: must\ncategory: functional\n---\nBody.\n`;
    await writeFileDeep(join(dir, 'knowledge/product/requirements/FR-001-dup.md'), dup);
    const { errors } = await validateNotes(dir);
    assert.ok(
      errors.some(e => /duplicate frontmatter key/i.test(e) && /title/.test(e)),
      `expected a duplicate-key error mentioning title, got: ${JSON.stringify(errors)}`,
    );
  } finally {
    await cleanup(dir);
  }
});

test('repeated keys at deeper indent are NOT flagged as duplicates', async () => {
  // Only top-level (indent-0) keys must be unique; repeated keys inside nested
  // mappings/sequences are legitimate YAML.
  const dir = await makeTmpDir();
  try {
    const nested = `---\nid: FR-002\ntype: requirement\ntitle: Nested\nstatus: draft\nsummary: S\npriority: must\ncategory: functional\ntags:\n  - a\n  - b\n---\nBody.\n`;
    await writeFileDeep(join(dir, 'knowledge/product/requirements/FR-002-nested.md'), nested);
    const { errors } = await validateNotes(dir);
    assert.ok(
      !errors.some(e => /duplicate frontmatter key/i.test(e)),
      `did not expect a duplicate-key error, got: ${JSON.stringify(errors)}`,
    );
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

// --- STATE.md scope gate (prevents derived-state drift) ---

const STATE_INTENT_ONLY = `# STATE — current focus (intent only)

## Now
Capturing ABC Budget knowledge.

## Next step
Send Prompt 1.1, then Prompts 2 → 6 (Phases 1–2c done). Open questions are \`Q-*\` notes
(see index/health.md). Deliverable: 2026-06-01-abc-budget-core-ui-design-brief.md.
`;

test('STATE.md scope: intent-only file passes (no false positives)', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'STATE.md'), STATE_INTENT_ONLY);
    assert.deepEqual(await checkStateScope(dir), []);
  } finally {
    await cleanup(dir);
  }
});

test('STATE.md scope: no STATE.md → no error', async () => {
  const dir = await makeTmpDir();
  try {
    assert.deepEqual(await checkStateScope(dir), []);
  } finally {
    await cleanup(dir);
  }
});

test('STATE.md scope: a note count is rejected', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'STATE.md'), '# STATE\n\nTotal notes: 133. Drilling 133 notes.\n');
    const errors = await checkStateScope(dir);
    assert.ok(errors.some(e => /STATE\.md/.test(e) && /count/i.test(e)),
      `expected a count error, got: ${JSON.stringify(errors)}`);
  } finally {
    await cleanup(dir);
  }
});

test('STATE.md scope: progress-by-domain + topic ids are rejected', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'STATE.md'), '# STATE\n\n## Progress by domain\n- TOP-002 product — empty\n');
    const errors = await checkStateScope(dir);
    assert.ok(errors.some(e => /Progress by domain/i.test(e)), `got: ${JSON.stringify(errors)}`);
    assert.ok(errors.some(e => /TOP-/.test(e)), `got: ${JSON.stringify(errors)}`);
  } finally {
    await cleanup(dir);
  }
});

test('STATE.md scope: open-item ids are rejected', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'STATE.md'), '# STATE\n\nOpen: Q-014, RISK-008.\n');
    const errors = await checkStateScope(dir);
    assert.ok(errors.some(e => /open-item/i.test(e)), `got: ${JSON.stringify(errors)}`);
  } finally {
    await cleanup(dir);
  }
});

test('STATE.md scope: gate is wired into validateNotes', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/users/JTBD-001-track.md'), JTBD);
    await writeFileDeep(join(dir, 'STATE.md'), '# STATE\n\nTotal notes: 42.\n');
    const { errors } = await validateNotes(dir);
    assert.ok(errors.some(e => /STATE\.md/.test(e)), `expected STATE.md error from validateNotes, got: ${JSON.stringify(errors)}`);
  } finally {
    await cleanup(dir);
  }
});
