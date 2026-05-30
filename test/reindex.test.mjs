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
