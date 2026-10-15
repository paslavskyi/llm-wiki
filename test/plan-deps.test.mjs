import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { planReadiness } from '../lib/plan-core.mjs';
import { dependencyCycles } from '../lib/relations.mjs';
import { validateNotes } from '../tools/validate.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const n = (id, deps, status = 'draft') => ({ frontmatter: { id, status, relations: deps ? { depends_on: deps } : undefined } });

test('planReadiness: first queue item whose dependencies are met is next', () => {
  const notes = [n('FEAT-001', ['FEAT-002']), n('FEAT-002'), n('FEAT-003', ['FEAT-004']), n('FEAT-004', null, 'accepted')];
  const r = planReadiness(['FEAT-001', 'FEAT-003', 'FEAT-002'], notes, new Set());
  assert.deepEqual(r.blocked, { 'FEAT-001': ['FEAT-002'] });
  assert.equal(r.next, 'FEAT-003'); // its dependency is accepted
});

test('planReadiness: a dependency done in plan history is met', () => {
  const notes = [n('FEAT-001', ['FEAT-002']), n('FEAT-002')];
  assert.equal(planReadiness(['FEAT-001'], notes, new Set(['FEAT-002'])).next, 'FEAT-001');
});

test('planReadiness: nothing ready → next is null', () => {
  const notes = [n('FEAT-001', ['FEAT-002']), n('FEAT-002', ['FEAT-001'])];
  assert.equal(planReadiness(['FEAT-001', 'FEAT-002'], notes, new Set()).next, null);
});

test('dependencyCycles: finds a cycle once, canonically rotated', () => {
  const notes = [n('A-1', ['A-2']), n('A-2', ['A-3']), n('A-3', ['A-1']), n('A-4', ['A-1'])];
  assert.deepEqual(dependencyCycles(notes), [['A-1', 'A-2', 'A-3']]);
  assert.deepEqual(dependencyCycles([n('A-1', ['A-2']), n('A-2')]), []);
});

test('validate: depends_on cycle is an error', async () => {
  const dir = await makeTmpDir();
  try {
    const feat = (id, dep) => `---\nid: ${id}\ntype: feature\ntitle: ${id}\nstatus: draft\nsummary: s\nrelations:\n  depends_on: [${dep}]\n---\n`;
    await writeFileDeep(join(dir, 'knowledge/product/FEAT-001-a.md'), feat('FEAT-001', 'FEAT-002'));
    await writeFileDeep(join(dir, 'knowledge/product/FEAT-002-b.md'), feat('FEAT-002', 'FEAT-001'));
    const { errors } = await validateNotes(dir);
    assert.deepEqual(errors, ['depends_on cycle: FEAT-001 → FEAT-002 → FEAT-001']);
  } finally { await cleanup(dir); }
});
