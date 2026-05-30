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
