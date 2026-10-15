import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { checkDecision, decisionSections } from '../lib/decision.mjs';
import { validateNotes } from '../tools/validate.mjs';
import { buildHealth } from '../tools/graph.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const FULL = '## Context\nx\n## Considered Options\n- a\n- b\n## Decision\na\n## Consequences\ny\n## Confirmation\nz\n';
const UK = '## Контекст\nx\n## Рішення\na\n## Наслідки\ny\n';

test('decisionSections: English and Ukrainian headings, case-insensitive', () => {
  assert.deepEqual(decisionSections(FULL), ['context', 'options', 'decision', 'consequences', 'confirmation']);
  assert.deepEqual(decisionSections(UK), ['context', 'decision', 'consequences']);
  assert.deepEqual(decisionSections('## DECISION\nx'), ['decision']);
});

test('checkDecision: accepted decision needs Context, Decision, Consequences', () => {
  assert.deepEqual(checkDecision({ type: 'decision', status: 'accepted' }, UK), []);
  assert.deepEqual(checkDecision({ type: 'decision', status: 'draft' }, ''), []);
  const errs = checkDecision({ type: 'decision', status: 'accepted' }, '## Decision\nx');
  assert.deepEqual(errs, ['accepted decision is missing section(s): Context, Consequences']);
  assert.deepEqual(checkDecision({ type: 'risk', status: 'accepted' }, ''), []);
});

const dec = (fm, body) => `---\nid: DEC-001\ntype: decision\ntitle: Use bank aggregator\nstatus: accepted\nsummary: s\n${fm}---\n${body}`;

test('validate: decision schema fields and sections', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/decisions/DEC-001-x.md'),
      dec('decided: 2026-10-01\ndeciders: [Andrii]\nconsulted: [CTO]\ninformed: [team]\nrevisit: 2027-04-01\n', FULL));
    assert.deepEqual((await validateNotes(dir)).errors, []);
    await writeFileDeep(join(dir, 'knowledge/decisions/DEC-001-x.md'), dec('revisit: someday\n', '## Decision\nx\n'));
    const { errors } = await validateNotes(dir);
    assert.equal(errors.length, 2);
    assert.match(errors.join('\n'), /schema error — \/revisit must match pattern/);
    assert.match(errors.join('\n'), /missing section\(s\): Context, Consequences/);
  } finally { await cleanup(dir); }
});

test('health: decisions without options/confirmation, and decisions due for review', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/decisions/DEC-001-x.md'), dec('revisit: 2026-09-01\n', UK));
    const { markdown } = await buildHealth(dir, { today: '2026-10-15' });
    assert.match(markdown, /### Decisions due for review\n- DEC-001 \(revisit 2026-09-01\)\n/);
    assert.match(markdown, /### Decisions without Considered Options \/ Confirmation\n- DEC-001 — options, confirmation\n/);
  } finally { await cleanup(dir); }
});

test('health: a decision with a future revisit date is not due', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/decisions/DEC-001-x.md'), dec('revisit: 2027-01-01\n', FULL));
    const { markdown } = await buildHealth(dir, { today: '2026-10-15' });
    assert.match(markdown, /### Decisions due for review\n_none_/);
    assert.match(markdown, /### Decisions without Considered Options \/ Confirmation\n_none_/);
  } finally { await cleanup(dir); }
});
