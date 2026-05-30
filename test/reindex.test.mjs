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

test('pipe in a cell is escaped and does not split the row', async () => {
  const dir = await makeTmpDir();
  try {
    const piped = `---\nid: JTBD-002\ntype: jtbd\ntitle: "Track A | B income"\nstatus: draft\nsummary: As a user I want to track A and B.\n---\n`;
    await writeFileDeep(join(dir, 'knowledge/users/JTBD-002-pipe.md'), piped);
    const { files } = await buildIndexes(dir);
    const idx = files['index/users.index.md'];
    // The pipe from the title must be escaped...
    assert.match(idx, /Track A \\\| B income/);
    // ...and must NOT appear as a bare, unescaped separator.
    assert.ok(!/[^\\]\| B income/.test(idx), 'raw unescaped pipe leaked into the table');
    // The data row should still have exactly the right number of columns (5 fields => 6 pipes).
    const row = idx.split('\n').find(l => l.includes('JTBD-002'));
    assert.ok(row, 'expected a row for JTBD-002');
    const sepCount = (row.match(/(?<!\\)\|/g) || []).length;
    assert.equal(sepCount, 6, `expected 6 column separators, got ${sepCount} in: ${row}`);
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

test('buildIndexes emits a nested mindmap.md tree', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/vision/TOP-001-vision.md'),
      `---\nid: TOP-001\ntype: topic\ntitle: Vision\nstatus: draft\nsummary: Area.\nparent: null\n---\n`);
    await writeFileDeep(join(dir, 'knowledge/vision/TOP-007-problem.md'),
      `---\nid: TOP-007\ntype: topic\ntitle: Problem\nstatus: draft\nsummary: Sub.\nparent: TOP-001\n---\n`);
    await writeFileDeep(join(dir, 'knowledge/vision/VIS-001-mission.md'),
      `---\nid: VIS-001\ntype: vision\ntitle: Mission\nstatus: draft\nsummary: M.\ntopic: TOP-001\n---\n`);
    const { files } = await buildIndexes(dir);
    const mm = files['index/mindmap.md'];
    assert.match(mm, /GENERATED/);
    assert.match(mm, /TOP-001/);
    assert.match(mm, /Vision/);
    const rootIdx = mm.indexOf('TOP-001');
    const childIdx = mm.indexOf('TOP-007');
    assert.ok(rootIdx < childIdx, 'root appears before child');
    assert.match(mm, /VIS-001/);
  } finally { await cleanup(dir); }
});

test('mindmap.md shows an unassigned section when a note has no topic', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/ENT-001-orphan.md'),
      `---\nid: ENT-001\ntype: entity\ntitle: Orphan\nstatus: draft\nsummary: O.\n---\n`);
    const { files } = await buildIndexes(dir);
    const mm = files['index/mindmap.md'];
    assert.match(mm, /unassigned/i);
    assert.match(mm, /ENT-001/);
  } finally { await cleanup(dir); }
});
