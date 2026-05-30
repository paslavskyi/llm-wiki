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
