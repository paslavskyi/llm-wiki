import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { checkVocabulary, EVIDENCE_TYPES } from '../lib/vocabulary.mjs';
import { healNote } from '../lib/heal.mjs';
import { extractLinks } from '../lib/note.mjs';
import { validateNotes } from '../tools/validate.mjs';
import { buildHealth } from '../tools/graph.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const SRC = `---
id: SRC-001
type: source
title: Interview with Olena
status: accepted
summary: 40-min call about budgeting habits.
kind: interview
origin: call 2026-10-01
---
> "I gave up on apps after a week."
`;

const persona = (status, extra = '') => `---
id: PER-001
type: persona
title: Busy parent
status: ${status}
summary: Parent with no time for budgeting.
${extra}---
Body.
`;

test('vocabulary: source notes live in knowledge/sources/ with SRC- ids', () => {
  const fm = { id: 'SRC-001', type: 'source' };
  assert.deepEqual(checkVocabulary(fm, 'sources'), []);
  assert.equal(checkVocabulary(fm, 'users').length, 1);
});

test('vocabulary: evidence-bearing claim types', () => {
  for (const t of ['persona', 'segment', 'jtbd', 'pain', 'competitor', 'market-insight']) {
    assert.ok(EVIDENCE_TYPES.has(t), t);
  }
  assert.ok(!EVIDENCE_TYPES.has('requirement'));
});

test('sources is a reference field (dangling/backlinks/impact see it)', () => {
  assert.deepEqual(extractLinks({ sources: ['SRC-001'] }, ''), ['SRC-001']);
});

test('heal: sources resolve deprecated ids and dedupe', () => {
  const healed = healNote(
    { frontmatter: { id: 'PER-001', type: 'persona', title: 't', status: 'draft', summary: 's',
      sources: ['SRC-001', 'SRC-002', 'SRC-001'] }, body: '' },
    { supersededIndex: new Map([['SRC-001', 'SRC-002']]), today: '2026-10-15' },
  );
  assert.deepEqual(healed.frontmatter.sources, ['SRC-002']);
});

test('validate: source note needs a known kind', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/sources/SRC-001-x.md'), SRC.replace('kind: interview', 'kind: gossip'));
    const { errors } = await validateNotes(dir);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /^SRC-001: schema error/);
  } finally { await cleanup(dir); }
});

test('validate: sources must point at source notes', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/sources/SRC-001-x.md'), SRC);
    await writeFileDeep(join(dir, 'knowledge/users/PER-002-y.md'),
      '---\nid: PER-002\ntype: persona\ntitle: Y\nstatus: draft\nsummary: s\n---\n');
    await writeFileDeep(join(dir, 'knowledge/users/PER-001-x.md'), persona('draft', 'sources: [SRC-001, PER-002]\n'));
    const { errors } = await validateNotes(dir);
    assert.deepEqual(errors, ['PER-001: sources → PER-002 must point to a source note']);
  } finally { await cleanup(dir); }
});

test('health: accepted claim without evidence, and unused sources', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/sources/SRC-001-x.md'), SRC);
    await writeFileDeep(join(dir, 'knowledge/users/PER-001-x.md'), persona('accepted'));
    const { markdown } = await buildHealth(dir);
    assert.match(markdown, /### Accepted claims without evidence[^#]*- PER-001/);
    assert.match(markdown, /### Unused sources[^#]*- SRC-001/);
  } finally { await cleanup(dir); }
});

test('health: evidenced claim and its source are not flagged', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/sources/SRC-001-x.md'), SRC);
    await writeFileDeep(join(dir, 'knowledge/users/PER-001-x.md'), persona('accepted', 'sources: [SRC-001]\n'));
    const { markdown } = await buildHealth(dir);
    assert.match(markdown, /### Accepted claims without evidence\n_none_/);
    assert.match(markdown, /### Unused sources\n_none_/);
  } finally { await cleanup(dir); }
});
