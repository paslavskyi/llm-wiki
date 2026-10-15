import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { RELATIONS, checkRelations, relationEdges } from '../lib/relations.mjs';
import { extractLinks } from '../lib/note.mjs';
import { healNote } from '../lib/heal.mjs';
import { validateNotes } from '../tools/validate.mjs';
import { buildIndexes } from '../tools/reindex.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const types = new Map([['FR-001', 'requirement'], ['RISK-001', 'risk'], ['PER-001', 'persona'], ['Q-001', 'question']]);

test('every relation names its inverse', () => {
  for (const [name, r] of Object.entries(RELATIONS)) assert.ok(r.inverse, name);
});

test('checkRelations: allowed pair passes', () => {
  assert.deepEqual(checkRelations({ type: 'requirement', relations: { mitigates: ['RISK-001'] } }, types), []);
});

test('checkRelations: unknown relation name', () => {
  const errs = checkRelations({ type: 'requirement', relations: { fixes: ['RISK-001'] } }, types);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /unknown relation "fixes"/);
});

test('checkRelations: disallowed source type', () => {
  const errs = checkRelations({ type: 'persona', relations: { mitigates: ['RISK-001'] } }, types);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /"mitigates" cannot start from a persona/);
});

test('checkRelations: disallowed target type', () => {
  const errs = checkRelations({ type: 'requirement', relations: { mitigates: ['PER-001'] } }, types);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /mitigates → PER-001: target must be risk, not persona/);
});

test('checkRelations: unconstrained relations accept any pair; dangling targets left to the dangling check', () => {
  assert.deepEqual(checkRelations({ type: 'persona', relations: { depends_on: ['Q-001'], answers: ['Q-001'] } }, types), []);
  assert.deepEqual(checkRelations({ type: 'requirement', relations: { mitigates: ['RISK-404'] } }, types), []);
});

test('checkRelations: relation values must be lists', () => {
  const errs = checkRelations({ type: 'requirement', relations: { mitigates: 'RISK-001' } }, types);
  assert.match(errs[0], /relation "mitigates" must be a list of ids/);
});

test('relation targets are references (dangling/backlinks/impact see them)', () => {
  assert.deepEqual(extractLinks({ relations: { mitigates: ['RISK-001'], serves: ['PER-001'] } }, '').sort(),
    ['PER-001', 'RISK-001']);
});

test('heal: relation lists resolve deprecated ids, dedupe, drop self-refs and empty lists', () => {
  const healed = healNote(
    { frontmatter: { id: 'FR-001', type: 'requirement', title: 't', status: 'draft', summary: 's',
      priority: 'must', category: 'functional',
      relations: { mitigates: ['RISK-001', 'RISK-002', 'FR-001'], depends_on: [] } }, body: '' },
    { supersededIndex: new Map([['RISK-001', 'RISK-002']]), today: '2026-10-15' },
  );
  assert.deepEqual(healed.frontmatter.relations, { mitigates: ['RISK-002'] });
});

test('relationEdges: forward edges and computed inverses', () => {
  const edges = relationEdges([
    { frontmatter: { id: 'FR-001', relations: { mitigates: ['RISK-001'], conflicts_with: ['FR-002'] } } },
  ]);
  assert.deepEqual(edges, {
    'FR-001': { mitigates: ['RISK-001'], conflicts_with: ['FR-002'] },
    'FR-002': { conflicts_with: ['FR-001'] },
    'RISK-001': { mitigated_by: ['FR-001'] },
  });
});

test('validate: wrong pair is an error; reindex writes index/relations.json', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/RISK-001-x.md'),
      '---\nid: RISK-001\ntype: risk\ntitle: R\nstatus: draft\nsummary: s\n---\n');
    await writeFileDeep(join(dir, 'knowledge/users/PER-001-x.md'),
      '---\nid: PER-001\ntype: persona\ntitle: P\nstatus: draft\nsummary: s\nrelations:\n  mitigates: [RISK-001]\n---\n');
    const { errors } = await validateNotes(dir);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /^PER-001: relation "mitigates" cannot start from a persona/);
    const { files } = await buildIndexes(dir);
    assert.deepEqual(JSON.parse(files['index/relations.json'])['RISK-001'], { mitigated_by: ['PER-001'] });
  } finally { await cleanup(dir); }
});
