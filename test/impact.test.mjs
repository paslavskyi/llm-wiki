import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeImpact } from '../tools/impact.mjs';

const note = (id, links = []) => ({ frontmatter: { id }, links });

const NOTES = [
  note('A', ['B']),       // A → B
  note('B', ['C']),       // B → C
  note('C', []),
  note('X', ['B']),       // X → B
];

test('depth 1: direct incoming and outgoing of B', () => {
  const { incoming, outgoing } = computeImpact('B', NOTES, 1);
  assert.deepEqual(incoming.sort(), ['A', 'X']);
  assert.deepEqual(outgoing.sort(), ['C']);
});

test('depth 2: transitive incoming of C includes A and X via B', () => {
  const { incoming } = computeImpact('C', NOTES, 2);
  assert.deepEqual(incoming.sort(), ['A', 'B', 'X']);
});

test('does not include the id itself', () => {
  const { incoming, outgoing } = computeImpact('B', NOTES, 2);
  assert.ok(!incoming.includes('B'));
  assert.ok(!outgoing.includes('B'));
});

test('tolerates a cycle without infinite loop', () => {
  const cyc = [note('P', ['Q']), note('Q', ['P'])];
  const { incoming, outgoing } = computeImpact('P', cyc, 5);
  assert.deepEqual(incoming, ['Q']);
  assert.deepEqual(outgoing, ['Q']);
});
