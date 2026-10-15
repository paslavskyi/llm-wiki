import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clarifyQueue } from '../lib/clarify.mjs';
import { extractLinks } from '../lib/note.mjs';

const n = (fm, body = '') => ({ frontmatter: { status: 'draft', ...fm }, body, links: extractLinks(fm, body) });

test('clarifyQueue: collects open questions and inline markers, skips resolved/deprecated', () => {
  const q = clarifyQueue([
    n({ id: 'Q-001', type: 'question', title: 'Which banks first?' }),
    n({ id: 'Q-002', type: 'question', title: 'Answered', status: 'accepted' }),
    n({ id: 'FR-001', type: 'requirement', priority: 'could' }, 'x [ASSUMPTION: card only]'),
    n({ id: 'FR-002', type: 'requirement', priority: 'must', status: 'deprecated' }, '[NEEDS CLARIFICATION: gone]'),
  ]);
  assert.deepEqual(q.map(i => `${i.id}:${i.kind}`), ['Q-001:question', 'FR-001:assumption']);
  assert.equal(q[0].text, 'Which banks first?');
  assert.equal(q[1].text, 'card only');
});

test('clarifyQueue: ranks must > could, clarification > assumption, referenced questions higher', () => {
  const q = clarifyQueue([
    n({ id: 'FR-001', type: 'requirement', priority: 'could' }, '[NEEDS CLARIFICATION: a]'),
    n({ id: 'FR-002', type: 'requirement', priority: 'must' }, '[ASSUMPTION: b] [NEEDS CLARIFICATION: c]'),
    n({ id: 'Q-001', type: 'question', title: 'lonely' }),
    n({ id: 'Q-002', type: 'question', title: 'popular' }),
    n({ id: 'FEAT-001', type: 'feature', links: ['Q-002'] }),
    n({ id: 'FEAT-002', type: 'feature', links: ['Q-002'] }),
  ]);
  // popular Q (3 + 2 refs) > must clarification (3 + 1) > must assumption (3) = lonely Q (3, id order) > could clarification (1 + 1)
  assert.deepEqual(q.map(i => i.text), ['popular', 'c', 'b', 'lonely', 'a']);
});

test('clarifyQueue: limit and topic scope', () => {
  const notes = [
    n({ id: 'Q-001', type: 'question', title: 'in', topic: 'TOP-002' }),
    n({ id: 'Q-002', type: 'question', title: 'out', topic: 'TOP-003' }),
    n({ id: 'Q-003', type: 'question', title: 'in2', topic: 'TOP-002' }),
  ];
  assert.deepEqual(clarifyQueue(notes, { topic: 'TOP-002' }).map(i => i.id), ['Q-001', 'Q-003']);
  assert.equal(clarifyQueue(notes, { limit: 1 }).length, 1);
});
