import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKnowledgeChanges } from '../lib/git-status.mjs';

test('parses untracked, modified, deleted under knowledge/', () => {
  const porcelain = [
    '?? knowledge/vision/VIS-001-x.md',
    ' M knowledge/users/PER-001-y.md',
    'A  knowledge/product/FR-001-z.md',
    'D  knowledge/old/ENT-009-gone.md',
    ' M tools/graph.mjs',          // not knowledge/ — ignored
    '?? index/health.md',          // not knowledge/ — ignored
    '?? notes.txt',                // not knowledge/ — ignored
  ].join('\n');
  const changes = parseKnowledgeChanges(porcelain);
  assert.deepEqual(changes.sort(), [
    'knowledge/old/ENT-009-gone.md',
    'knowledge/product/FR-001-z.md',
    'knowledge/users/PER-001-y.md',
    'knowledge/vision/VIS-001-x.md',
  ]);
});

test('empty porcelain → no changes', () => {
  assert.deepEqual(parseKnowledgeChanges(''), []);
});

test('handles renamed entries (R) pointing into knowledge/', () => {
  const porcelain = 'R  knowledge/a/OLD-1-a.md -> knowledge/a/NEW-1-a.md';
  const changes = parseKnowledgeChanges(porcelain);
  assert.ok(changes.includes('knowledge/a/NEW-1-a.md'));
});
