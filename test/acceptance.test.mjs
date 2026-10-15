import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { checkAcceptance, criterionForm, isVague, healAcceptance } from '../lib/acceptance.mjs';
import { extractLinks, extractCriterionRefs } from '../lib/note.mjs';
import { healNote } from '../lib/heal.mjs';
import { validateNotes } from '../tools/validate.mjs';
import { buildHealth } from '../tools/graph.mjs';
import { computeCoverage } from '../lib/coverage.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const FR = { id: 'FR-012', type: 'requirement' };

test('criterionForm: EARS and Given/When/Then, English and Ukrainian', () => {
  assert.equal(criterionForm('WHEN the month ends THE SYSTEM SHALL email a summary'), 'ears');
  assert.equal(criterionForm('The system shall reject negative amounts'), 'ears');
  assert.equal(criterionForm('КОЛИ місяць закінчується, СИСТЕМА ПОВИННА надіслати звіт'), 'ears');
  assert.equal(criterionForm('Given a budget, when I overspend, then I see a warning'), 'gwt');
  assert.equal(criterionForm('ДАНО бюджет, КОЛИ я перевищую ліміт, ТОДІ бачу попередження'), 'gwt');
  assert.equal(criterionForm('Works nicely'), null);
});

test('isVague: vague adjective without a number', () => {
  assert.equal(isVague('Sync must be fast'), true);
  assert.equal(isVague('Синхронізація має бути швидкою'), true);
  assert.equal(isVague('Sync must be fast (under 2 s at p95)'), false);
  assert.equal(isVague('Sync runs nightly'), false);
});

test('healAcceptance: strings become numbered criteria; existing ids kept; numbering continues', () => {
  assert.deepEqual(healAcceptance('FR-012', ['A shall b', { id: 'FR-012.4', text: 'C shall d' }, { text: 'E shall f' }]), [
    { id: 'FR-012.5', text: 'A shall b' },
    { id: 'FR-012.4', text: 'C shall d' },
    { id: 'FR-012.6', text: 'E shall f' },
  ]);
});

test('heal: acceptance is normalised through healNote', () => {
  const healed = healNote({ frontmatter: { id: 'STORY-001', type: 'story', title: 't', status: 'draft',
    summary: 's', acceptance: ['Given x when y then z'] }, body: '' }, { today: '2026-10-15' });
  assert.deepEqual(healed.frontmatter.acceptance, [{ id: 'STORY-001.1', text: 'Given x when y then z' }]);
});

test('checkAcceptance: only requirement/nfr/story; ids must belong to the note and be unique', () => {
  assert.deepEqual(checkAcceptance({ ...FR, acceptance: [{ id: 'FR-012.1', text: 'x shall y' }] }), []);
  assert.match(checkAcceptance({ id: 'PER-001', type: 'persona', acceptance: [] })[0], /acceptance is only for requirement\/nfr\/story/);
  assert.match(checkAcceptance({ ...FR, acceptance: [{ id: 'FR-013.1', text: 'x' }] })[0], /criterion id "FR-013.1" must look like FR-012.<n>/);
  assert.match(checkAcceptance({ ...FR, acceptance: [{ id: 'FR-012.1', text: 'a' }, { id: 'FR-012.1', text: 'b' }] })[0], /duplicate criterion id FR-012.1/);
  assert.match(checkAcceptance({ ...FR, acceptance: [{ id: 'FR-012.1', text: '' }] })[0], /criterion FR-012.1 needs text/);
});

test('criterion references point at the note and are collected separately', () => {
  const fm = { links: ['FR-012.2'] };
  assert.deepEqual(extractLinks(fm, 'see [[FR-012.1]]'), ['FR-012']);
  assert.deepEqual(extractCriterionRefs(fm, 'see [[FR-012.1]]').sort(), ['FR-012.1', 'FR-012.2']);
});

const fr = (acc) => `---
id: FR-012
type: requirement
title: Monthly summary
status: draft
summary: s
priority: must
category: functional
acceptance:
${acc}
---
`;

test('validate: reference to a missing criterion is an error', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/FR-012-x.md'),
      fr('  - id: FR-012.1\n    text: WHEN the month ends THE SYSTEM SHALL email a summary'));
    await writeFileDeep(join(dir, 'knowledge/product/STORY-001-x.md'),
      '---\nid: STORY-001\ntype: story\ntitle: S\nstatus: draft\nsummary: s\n---\nCovers [[FR-012.1]] and [[FR-012.7]].\n');
    const { errors } = await validateNotes(dir);
    assert.deepEqual(errors, ['STORY-001: criterion FR-012.7 does not exist']);
  } finally { await cleanup(dir); }
});

test('health: criteria not in EARS/GWT form, and vague wording', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/FR-012-x.md'),
      fr('  - id: FR-012.1\n    text: Summary looks nice\n  - id: FR-012.2\n    text: THE SYSTEM SHALL be fast'));
    const { markdown } = await buildHealth(dir);
    assert.match(markdown, /### Acceptance criteria not in EARS \/ Given-When-Then form\n- FR-012.1\n/);
    assert.match(markdown, /### Vague wording without a number\n- FR-012.2\n/);
  } finally { await cleanup(dir); }
});

test('coverage: must-requirements and stories need acceptance criteria', () => {
  const n = (fm) => ({ frontmatter: { status: 'draft', ...fm }, links: [] });
  const res = computeCoverage([
    n({ id: 'FR-001', type: 'requirement', priority: 'must' }),
    n({ id: 'FR-002', type: 'requirement', priority: 'must', acceptance: [{ id: 'FR-002.1', text: 'x' }] }),
    n({ id: 'STORY-001', type: 'story' }),
  ]);
  assert.deepEqual(res.find(r => r.key === 'must-requirement-acceptance').gaps, ['FR-001']);
  assert.deepEqual(res.find(r => r.key === 'story-acceptance').gaps, ['STORY-001']);
});
