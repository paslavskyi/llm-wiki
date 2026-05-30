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
