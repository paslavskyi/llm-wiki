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
