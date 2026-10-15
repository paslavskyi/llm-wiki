import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import { runQuery, checkQuery } from '../lib/query.mjs';
import { extractLinks } from '../lib/note.mjs';

const n = (fm) => ({ frontmatter: { status: 'draft', ...fm }, links: extractLinks(fm, '') });
const NOTES = [
  n({ id: 'FR-001', type: 'requirement', title: 'Sync', priority: 'must', acceptance: [{ id: 'FR-001.1', text: 'x' }] }),
  n({ id: 'FR-002', type: 'requirement', title: 'Export', priority: 'must' }),
  n({ id: 'FR-003', type: 'requirement', title: 'Themes', priority: 'could', status: 'accepted' }),
  n({ id: 'FR-004', type: 'requirement', title: 'Old', priority: 'must', status: 'deprecated' }),
  n({ id: 'FEAT-001', type: 'feature', title: 'Bank sync', relations: { serves: ['PER-001'] } }),
  n({ id: 'FEAT-002', type: 'feature', title: 'CSV', links: ['PER-002'] }),
  n({ id: 'DEC-001', type: 'decision', title: 'B', status: 'accepted', decided: '2026-09-01' }),
  n({ id: 'DEC-002', type: 'decision', title: 'A', status: 'accepted', decided: '2026-10-01' }),
];
const ids = (rows) => rows.map(r => r.id);

test('from + equality; deprecated excluded by default', () => {
  assert.deepEqual(ids(runQuery({ from: ['requirement'], where: [{ priority: 'must' }] }, NOTES)), ['FR-001', 'FR-002']);
  assert.deepEqual(ids(runQuery({ from: ['requirement'], include_deprecated: true, where: [{ priority: 'must' }] }, NOTES)),
    ['FR-001', 'FR-002', 'FR-004']);
});

test('operators: in, not, empty, has, comparisons, missing', () => {
  const q = (where, from = ['requirement']) => ids(runQuery({ from, where }, NOTES));
  assert.deepEqual(q([{ priority: { in: ['could', 'should'] } }]), ['FR-003']);
  assert.deepEqual(q([{ status: { not: 'accepted' } }]), ['FR-001', 'FR-002']);
  assert.deepEqual(q([{ acceptance: { empty: true } }]), ['FR-002', 'FR-003']);
  assert.deepEqual(q([{ 'relations.serves': { has: 'PER-001' } }], ['feature']), ['FEAT-001']);
  assert.deepEqual(q([{ decided: { gte: '2026-10-01' } }], ['decision']), ['DEC-002']);
  assert.deepEqual(q([{ decided: { missing: true } }], ['decision']), []);
});

test('refs: any reference to an id (links, relations, …); params substitute $param', () => {
  const spec = { from: ['feature'], where: [{ refs: '$param' }] };
  assert.deepEqual(ids(runQuery(spec, NOTES, { param: 'PER-002' })), ['FEAT-002']);
  assert.deepEqual(ids(runQuery(spec, NOTES, { param: 'PER-001' })), ['FEAT-001']);
});

test('sort (desc with -), limit, show', () => {
  const rows = runQuery({ from: ['decision'], sort: '-decided', show: ['id', 'decided'], limit: 1 }, NOTES);
  assert.deepEqual(rows, [{ id: 'DEC-002', decided: '2026-10-01' }]);
});

test('checkQuery: rejects unknown keys and operators, requires a param when $param is used', () => {
  assert.deepEqual(checkQuery({ title: 't', from: ['requirement'], where: [{ priority: 'must' }] }), []);
  assert.match(checkQuery({ title: 't', form: [] })[0], /unknown key "form"/);
  assert.match(checkQuery({ title: 't', where: [{ priority: { like: 'm' } }] })[0], /unknown operator "like"/);
  assert.match(checkQuery({ title: 't', from: ['banana'] })[0], /unknown type "banana"/);
  assert.match(checkQuery({ title: 't', where: [{ refs: '$param' }] }, {})[0], /needs --param/);
});

test('shipped queries/ are all valid', async () => {
  const dir = new URL('../queries/', import.meta.url);
  const files = (await readdir(dir)).filter(f => f.endsWith('.yml'));
  assert.ok(files.length >= 3);
  for (const f of files) {
    const spec = yaml.load(await readFile(new URL(f, dir), 'utf8'));
    assert.deepEqual(checkQuery(spec, { param: 'X-1' }), [], f);
  }
});

test('in: an absent field matches null', () => {
  const notes = [n({ id: 'ASMP-001', type: 'assumption' }), n({ id: 'ASMP-002', type: 'assumption', validation: 'validated' }),
    n({ id: 'ASMP-003', type: 'assumption', validation: 'open' })];
  assert.deepEqual(ids(runQuery({ from: ['assumption'], where: [{ validation: { in: ['open', null] } }] }, notes)),
    ['ASMP-001', 'ASMP-003']);
});
