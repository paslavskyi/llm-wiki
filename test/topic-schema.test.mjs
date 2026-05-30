import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadValidators } from '../lib/schemas.mjs';

test('topic schema accepts a valid top-level topic (parent null)', async () => {
  const { validatorFor } = await loadValidators();
  const v = validatorFor('topic');
  assert.equal(v({
    id: 'TOP-001', type: 'topic', title: 'Vision', status: 'draft',
    summary: 'Vision area.', parent: null,
  }), true);
});

test('topic schema accepts a child topic with TOP- parent', async () => {
  const { validatorFor } = await loadValidators();
  const v = validatorFor('topic');
  assert.equal(v({
    id: 'TOP-007', type: 'topic', title: 'Problem space', status: 'draft',
    summary: 'Sub-area.', parent: 'TOP-001',
  }), true);
});

test('topic schema rejects a non-TOP parent string', async () => {
  const { validatorFor } = await loadValidators();
  const v = validatorFor('topic');
  assert.equal(v({
    id: 'TOP-007', type: 'topic', title: 'X', status: 'draft',
    summary: 'S', parent: 'FR-001',
  }), false);
});

test('topic schema rejects wrong type', async () => {
  const { validatorFor } = await loadValidators();
  const v = validatorFor('topic');
  assert.equal(v({
    id: 'TOP-007', type: 'requirement', title: 'X', status: 'draft',
    summary: 'S', parent: null,
  }), false);
});

test('base schema allows an optional topic field on concrete notes', async () => {
  const { validatorFor } = await loadValidators();
  const v = validatorFor('vision'); // falls back to base
  assert.equal(v({
    id: 'VIS-001', type: 'vision', title: 'T', status: 'draft',
    summary: 'S', topic: 'TOP-001',
  }), true);
});

import { join } from 'node:path';
import { validateNotes } from '../tools/validate.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const TOPIC_VISION = `---
id: TOP-001
type: topic
title: Vision
status: draft
summary: Vision area.
parent: null
---
`;

test('valid topic tree + attached note passes', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/vision/TOP-001-vision.md'), TOPIC_VISION);
    await writeFileDeep(join(dir, 'knowledge/vision/VIS-001-mission.md'),
      `---\nid: VIS-001\ntype: vision\ntitle: Mission\nstatus: draft\nsummary: M.\ntopic: TOP-001\n---\n`);
    const { errors } = await validateNotes(dir);
    assert.deepEqual(errors, []);
  } finally { await cleanup(dir); }
});

test('parent pointing to a missing topic is reported', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/vision/TOP-009-x.md'),
      `---\nid: TOP-009\ntype: topic\ntitle: X\nstatus: draft\nsummary: S.\nparent: TOP-404\n---\n`);
    const { errors } = await validateNotes(dir);
    assert.ok(errors.some(e => /TOP-009/.test(e) && /TOP-404/.test(e) && /parent/i.test(e)));
  } finally { await cleanup(dir); }
});

test('topic field pointing to a non-topic note is reported', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/vision/TOP-001-vision.md'), TOPIC_VISION);
    // VIS-002 points its `topic` at VIS-001 (not a topic)
    await writeFileDeep(join(dir, 'knowledge/vision/VIS-001-mission.md'),
      `---\nid: VIS-001\ntype: vision\ntitle: M\nstatus: draft\nsummary: M.\ntopic: TOP-001\n---\n`);
    await writeFileDeep(join(dir, 'knowledge/vision/VIS-002-x.md'),
      `---\nid: VIS-002\ntype: vision\ntitle: X\nstatus: draft\nsummary: X.\ntopic: VIS-001\n---\n`);
    const { errors } = await validateNotes(dir);
    assert.ok(errors.some(e => /VIS-002/.test(e) && /VIS-001/.test(e) && /topic/i.test(e)));
  } finally { await cleanup(dir); }
});

test('empty-string topic yields only a schema error, not a "does not exist" line', async () => {
  const dir = await makeTmpDir();
  try {
    // Unique nonce in summary defeats gray-matter's in-process content cache.
    const nonce = `nonce-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await writeFileDeep(join(dir, 'knowledge/vision/VIS-003-empty.md'),
      `---\nid: VIS-003\ntype: vision\ntitle: X\nstatus: draft\nsummary: ${nonce}\ntopic: ""\n---\n`);
    const { errors } = await validateNotes(dir);
    const mine = errors.filter(e => /VIS-003/.test(e));
    // No redundant "does not exist" noise for the blank target...
    assert.equal(mine.filter(e => /does not exist/.test(e)).length, 0);
    // ...but the schema still rejects the empty string.
    assert.ok(mine.some(e => /schema/i.test(e)), `expected a schema error, got: ${JSON.stringify(mine)}`);
  } finally { await cleanup(dir); }
});
