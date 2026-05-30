import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDelta } from '../tools/session-delta.mjs';

const lines = [
  'A\tknowledge/vision/VIS-001-x.md',
  'M\tknowledge/users/PER-001-y.md',
  'D\tknowledge/old/ENT-009-z.md',
  'A\tknowledge/users/PER-002-w.md',
  'M\ttools/graph.mjs',              // non-knowledge ignored
].join('\n');

test('classifies added/updated/deleted under knowledge/', () => {
  const d = classifyDelta(lines, {});
  assert.deepEqual(d.added.sort(), ['knowledge/users/PER-002-w.md', 'knowledge/vision/VIS-001-x.md']);
  assert.deepEqual(d.updated, ['knowledge/users/PER-001-y.md']);
  assert.deepEqual(d.deleted, ['knowledge/old/ENT-009-z.md']);
});

test('area filter restricts to a knowledge subfolder', () => {
  const d = classifyDelta(lines, { area: 'users' });
  assert.deepEqual(d.added, ['knowledge/users/PER-002-w.md']);
  assert.deepEqual(d.updated, ['knowledge/users/PER-001-y.md']);
  assert.deepEqual(d.deleted, []);
});

test('empty diff → empty buckets', () => {
  const d = classifyDelta('', {});
  assert.deepEqual(d, { added: [], updated: [], deleted: [] });
});
