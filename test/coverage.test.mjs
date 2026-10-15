import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { computeCoverage, COVERAGE_RULES } from '../lib/coverage.mjs';
import { extractLinks } from '../lib/note.mjs';
import { buildIndexes } from '../tools/reindex.mjs';
import { buildHealth } from '../tools/graph.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const note = (fm) => ({ frontmatter: { status: 'draft', ...fm }, links: extractLinks(fm, '') });
const rule = (result, key) => result.find(r => r.key === key);

test('every rule has a key, label and needs', () => {
  for (const r of COVERAGE_RULES) assert.ok(r.key && r.label && r.needs, r.key);
});

test('must-requirement is covered by a linked story (either direction), not by a should one', () => {
  const res = computeCoverage([
    note({ id: 'FR-001', type: 'requirement', priority: 'must' }),
    note({ id: 'FR-002', type: 'requirement', priority: 'must' }),
    note({ id: 'FR-003', type: 'requirement', priority: 'should' }),
    note({ id: 'STORY-001', type: 'story', relations: { refines: ['FR-001'] } }),
  ]);
  const r = rule(res, 'must-requirement-delivery');
  assert.equal(r.applicable, 2);
  assert.deepEqual(r.gaps, ['FR-002']);
});

test('risk needs a mitigates relation; accepted (consciously taken) risks are exempt', () => {
  const res = computeCoverage([
    note({ id: 'RISK-001', type: 'risk' }),
    note({ id: 'RISK-002', type: 'risk', status: 'accepted' }),
    note({ id: 'RISK-003', type: 'risk' }),
    note({ id: 'FR-001', type: 'requirement', relations: { mitigates: ['RISK-003'] } }),
    note({ id: 'FR-002', type: 'requirement', links: ['RISK-001'] }), // plain link is not mitigation
  ]);
  const r = rule(res, 'risk-mitigation');
  assert.equal(r.applicable, 2);
  assert.deepEqual(r.gaps, ['RISK-001']);
});

test('deprecated notes are ignored on both sides', () => {
  const res = computeCoverage([
    note({ id: 'PER-001', type: 'persona' }),
    note({ id: 'PER-002', type: 'persona', status: 'deprecated' }),
    note({ id: 'JTBD-001', type: 'jtbd', status: 'deprecated', links: ['PER-001'] }),
  ]);
  const r = rule(res, 'persona-needs');
  assert.equal(r.applicable, 1);
  assert.deepEqual(r.gaps, ['PER-001']);
});

test('goal with empty scope is a gap', () => {
  const res = computeCoverage([
    note({ id: 'GOAL-001', type: 'goal', scope: [] }),
    note({ id: 'GOAL-002', type: 'goal', scope: ['FR-001'] }),
  ]);
  assert.deepEqual(rule(res, 'goal-scope').gaps, ['GOAL-001']);
});

test('reindex writes index/coverage.md; health points to it', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/FR-001-x.md'),
      '---\nid: FR-001\ntype: requirement\ntitle: X\nstatus: draft\nsummary: s\npriority: must\ncategory: functional\n---\n');
    const { files } = await buildIndexes(dir);
    const md = files['index/coverage.md'];
    assert.match(md, /GENERATED/);
    assert.match(md, /Must-have requirements[^\n]*\| 0\/1 \| 0%/);
    assert.match(md, /- FR-001/);
    const { markdown } = await buildHealth(dir);
    assert.match(markdown, /### Coverage gaps\n- 1 gap\(s\) across 1 rule\(s\) — see index\/coverage\.md/);
  } finally { await cleanup(dir); }
});
