import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { checkValidation } from '../lib/assumption.mjs';
import { isOpenNote } from '../lib/open.mjs';
import { validateNotes } from '../tools/validate.mjs';
import { buildHealth } from '../tools/graph.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const A = { id: 'ASMP-001', type: 'assumption', status: 'accepted' };

test('checkValidation: only assumptions carry validation; a verdict needs evidence', () => {
  assert.deepEqual(checkValidation({ ...A }), []);
  assert.deepEqual(checkValidation({ ...A, validation: 'open' }), []);
  assert.deepEqual(checkValidation({ ...A, validation: 'validated', sources: ['SRC-001'] }), []);
  assert.deepEqual(checkValidation({ ...A, validation: 'invalidated' }),
    ['validation "invalidated" needs evidence — cite the source(s) in `sources:`']);
  assert.deepEqual(checkValidation({ id: 'FR-001', type: 'requirement', validation: 'open' }),
    ['validation is only for assumption notes']);
});

test('isOpenNote: a validated or invalidated assumption is no longer open', () => {
  assert.equal(isOpenNote({ ...A, status: 'draft' }), true);
  assert.equal(isOpenNote({ ...A, status: 'draft', validation: 'open' }), true);
  assert.equal(isOpenNote({ ...A, status: 'draft', validation: 'validated' }), false);
  assert.equal(isOpenNote({ ...A, status: 'draft', validation: 'invalidated' }), false);
  assert.equal(isOpenNote({ id: 'Q-001', type: 'question', status: 'draft' }), true);
});

const SRC = '---\nid: SRC-001\ntype: source\ntitle: Survey\nstatus: accepted\nsummary: s\nkind: survey\n---\n';
const asmp = (extra) => `---\nid: ASMP-001\ntype: assumption\ntitle: Users pay by card\nstatus: accepted\nsummary: s\n${extra}---\n`;

test('validate: unknown validation value and verdict without sources', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/sources/SRC-001-x.md'), SRC);
    await writeFileDeep(join(dir, 'knowledge/product/ASMP-001-x.md'), asmp('validation: maybe\n'));
    assert.match((await validateNotes(dir)).errors.join('\n'), /ASMP-001: schema error — \/validation must be equal to one of the allowed values/);
    await writeFileDeep(join(dir, 'knowledge/product/ASMP-001-x.md'), asmp('validation: validated\n'));
    assert.deepEqual((await validateNotes(dir)).errors, ['ASMP-001: validation "validated" needs evidence — cite the source(s) in `sources:`']);
  } finally { await cleanup(dir); }
});

test('health: invalidated assumption still relied on by live notes', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/sources/SRC-001-x.md'), SRC);
    await writeFileDeep(join(dir, 'knowledge/product/ASMP-001-x.md'), asmp('validation: invalidated\nsources: [SRC-001]\n'));
    await writeFileDeep(join(dir, 'knowledge/product/FR-001-x.md'),
      '---\nid: FR-001\ntype: requirement\ntitle: Card only\nstatus: draft\nsummary: s\npriority: must\ncategory: functional\nlinks: [ASMP-001]\n---\n');
    const { markdown } = await buildHealth(dir);
    assert.match(markdown, /### Invalidated assumptions still relied on\n- ASMP-001 ← FR-001\n/);
    assert.doesNotMatch(markdown, /### Open questions \/ risks \/ assumptions\n- ASMP-001/);
  } finally { await cleanup(dir); }
});
