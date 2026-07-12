import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOpenNote, OPEN_TYPES } from '../lib/open.mjs';

test('question/risk/assumption are the open-capable types', () => {
  assert.deepEqual([...OPEN_TYPES].sort(), ['assumption', 'question', 'risk']);
});

test('proposed/draft cross-cutting items are open', () => {
  assert.ok(isOpenNote({ type: 'risk', status: 'proposed' }));
  assert.ok(isOpenNote({ type: 'question', status: 'draft' }));
});

test('accepted items are closed', () => {
  assert.ok(!isOpenNote({ type: 'risk', status: 'accepted' }));
});

test('deprecated items are NOT open (the graph/dashboard divergence this fixes)', () => {
  assert.ok(!isOpenNote({ type: 'assumption', status: 'deprecated' }));
});

test('non-cross-cutting types are never open', () => {
  assert.ok(!isOpenNote({ type: 'feature', status: 'proposed' }));
});
