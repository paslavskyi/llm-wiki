import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { findMarkers, checkMarkers } from '../lib/markers.mjs';
import { validateNotes } from '../tools/validate.mjs';
import { writeNote } from '../tools/write-note.mjs';
import { buildHealth } from '../tools/graph.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

test('findMarkers: both kinds, with and without text', () => {
  const body = 'Limit is [NEEDS CLARIFICATION: per month or per week?].\n'
    + 'Users pay by card [ASSUMPTION: no cash flow in MVP]. Also [ASSUMPTION].';
  assert.deepEqual(findMarkers(body), [
    { kind: 'NEEDS CLARIFICATION', text: 'per month or per week?' },
    { kind: 'ASSUMPTION', text: 'no cash flow in MVP' },
    { kind: 'ASSUMPTION', text: '' },
  ]);
});

test('findMarkers: ignores fenced code and inline code', () => {
  const body = 'Write `[ASSUMPTION: x]` like this:\n```\n[NEEDS CLARIFICATION: y]\n```\n';
  assert.deepEqual(findMarkers(body), []);
});

test('checkMarkers: only accepted notes are blocked', () => {
  const body = 'x [NEEDS CLARIFICATION: y]';
  assert.deepEqual(checkMarkers({ status: 'draft' }, body), []);
  assert.deepEqual(checkMarkers({ status: 'proposed' }, body), []);
  const errs = checkMarkers({ status: 'accepted' }, body);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /accepted with 1 unresolved marker/);
});

const fr = (status, body) => `---
id: FR-001
type: requirement
title: Budget limit
status: ${status}
summary: s
priority: must
category: functional
---
${body}
`;

test('validate: accepted note with a marker fails', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/FR-001-x.md'), fr('accepted', 'Limit [NEEDS CLARIFICATION: period?]'));
    const { errors } = await validateNotes(dir);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /^FR-001: accepted with 1 unresolved marker/);
  } finally { await cleanup(dir); }
});

test('writeNote refuses to accept a note that still has markers', async () => {
  const dir = await makeTmpDir();
  try {
    const target = join(dir, 'knowledge/product/FR-001-budget-limit.md');
    const intent = { frontmatter: { id: 'FR-001', type: 'requirement', title: 'Budget limit', status: 'accepted',
      summary: 's', priority: 'must', category: 'functional' }, body: 'x [ASSUMPTION: y]' };
    await assert.rejects(writeNote(dir, target, intent), /unresolved marker/);
  } finally { await cleanup(dir); }
});

test('health: lists notes with unresolved markers and their count', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/FR-001-x.md'),
      fr('draft', '[NEEDS CLARIFICATION: a] and [ASSUMPTION: b]'));
    const { markdown } = await buildHealth(dir);
    assert.match(markdown, /### Unresolved markers[^#]*- FR-001 — 1 clarification, 1 assumption/);
  } finally { await cleanup(dir); }
});
