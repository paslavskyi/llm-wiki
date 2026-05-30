import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../lib/mindmap.mjs';

function note(fm) { return { frontmatter: fm }; }

const NOTES = [
  note({ id: 'TOP-002', type: 'topic', title: 'Users', parent: null }),
  note({ id: 'TOP-001', type: 'topic', title: 'Vision', parent: null }),
  note({ id: 'TOP-007', type: 'topic', title: 'Problem', parent: 'TOP-001' }),
  note({ id: 'VIS-001', type: 'vision', title: 'Mission', topic: 'TOP-001' }),
  note({ id: 'PAIN-003', type: 'pain', title: 'Manual entry', topic: 'TOP-007' }),
  note({ id: 'PER-001', type: 'persona', title: 'Busy parent', topic: 'TOP-002' }),
  note({ id: 'ENT-001', type: 'entity', title: 'Orphan' }),
];

test('buildTree returns roots sorted by id with nested children', () => {
  const { roots } = buildTree(NOTES);
  assert.deepEqual(roots.map(r => r.id), ['TOP-001', 'TOP-002']);
  const vision = roots[0];
  assert.equal(vision.children[0].id, 'TOP-007');
  assert.deepEqual(vision.notes.map(n => n.id), ['VIS-001']);
  assert.deepEqual(vision.children[0].notes.map(n => n.id), ['PAIN-003']);
});

test('buildTree collects notes without a topic into unassigned', () => {
  const { unassigned } = buildTree(NOTES);
  assert.deepEqual(unassigned.map(n => n.id), ['ENT-001']);
});

test('buildTree does not place topic notes into unassigned', () => {
  const { unassigned } = buildTree(NOTES);
  assert.ok(!unassigned.some(n => n.id.startsWith('TOP-')));
});

test('buildTree tolerates a dangling parent (treats node as a root)', () => {
  const orphanParent = [note({ id: 'TOP-050', type: 'topic', title: 'Lost', parent: 'TOP-999' })];
  const { roots } = buildTree(orphanParent);
  assert.deepEqual(roots.map(r => r.id), ['TOP-050']);
});

test('buildTree tolerates a 2-node cycle without infinite loop', () => {
  const cyclic = [
    note({ id: 'TOP-010', type: 'topic', title: 'A', parent: 'TOP-011' }),
    note({ id: 'TOP-011', type: 'topic', title: 'B', parent: 'TOP-010' }),
  ];
  const { roots } = buildTree(cyclic);
  assert.ok(Array.isArray(roots));
  // Both cyclic nodes are promoted to roots deterministically, no duplication.
  assert.deepEqual(roots.map(r => r.id).sort(), ['TOP-010', 'TOP-011']);
});

test('buildTree tolerates a 3-node cycle, promoting all three to roots once', () => {
  const cyclic = [
    note({ id: 'TOP-020', type: 'topic', title: 'A', parent: 'TOP-022' }),
    note({ id: 'TOP-021', type: 'topic', title: 'B', parent: 'TOP-020' }),
    note({ id: 'TOP-022', type: 'topic', title: 'C', parent: 'TOP-021' }),
  ];
  const { roots } = buildTree(cyclic);
  assert.equal(roots.length, 3);
  assert.deepEqual(roots.map(r => r.id).sort(), ['TOP-020', 'TOP-021', 'TOP-022']);
});

test('buildTree puts a note with a dangling topic into unassigned, not under a root', () => {
  const notes = [
    note({ id: 'TOP-001', type: 'topic', title: 'Vision', parent: null }),
    note({ id: 'FR-009', type: 'requirement', title: 'X', topic: 'TOP-404' }),
  ];
  const { roots, unassigned } = buildTree(notes);
  assert.ok(unassigned.some(n => n.id === 'FR-009'));
  // It must not be attached to any topic node.
  const collect = (node) => [...node.notes, ...node.children.flatMap(collect)];
  const attached = roots.flatMap(collect).map(n => n.id);
  assert.ok(!attached.includes('FR-009'));
});
