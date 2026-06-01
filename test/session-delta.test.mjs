import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyDelta } from '../tools/session-delta.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'session-delta.mjs');

const lines = [
  'A\tknowledge/vision/VIS-001-x.md',
  'M\tknowledge/users/PER-001-y.md',
  'D\tknowledge/old/ENT-009-z.md',
  'A\tknowledge/users/PER-002-w.md',
  'M\ttools/graph.mjs',              // non-knowledge ignored
].join('\n');

test('classifies added/updated/deleted under knowledge/', () => {
  const d = classifyDelta(lines, {});
  assert.deepEqual(d.added.sort(), ['knowledge/users/PER-002-w.md', 'knowledge/vision/VIS-001-x.md']);
  assert.deepEqual(d.updated, ['knowledge/users/PER-001-y.md']);
  assert.deepEqual(d.deleted, ['knowledge/old/ENT-009-z.md']);
});

test('area filter restricts to a knowledge subfolder', () => {
  const d = classifyDelta(lines, { area: 'users' });
  assert.deepEqual(d.added, ['knowledge/users/PER-002-w.md']);
  assert.deepEqual(d.updated, ['knowledge/users/PER-001-y.md']);
  assert.deepEqual(d.deleted, []);
});

test('empty diff → empty buckets', () => {
  const d = classifyDelta('', {});
  assert.deepEqual(d, { added: [], updated: [], deleted: [] });
});

test('classifies git-quoted non-ASCII paths (Cyrillic) — defense in depth', () => {
  // git with core.quotePath=true wraps non-ASCII paths in quotes + octal escapes.
  // classifyDelta must still recognize them as knowledge/ notes.
  const quoted = [
    'A\t"knowledge/problem/PAIN-001-\\321\\201\\320\\272\\320\\273\\320\\260\\320\\264\\320\\275\\321\\226\\321\\201\\321\\202\\321\\214.md"',
    'M\t"knowledge/users/PER-001-\\320\\277\\320\\265\\321\\200\\321\\201\\320\\276\\320\\275\\320\\260.md"',
  ].join('\n');
  const d = classifyDelta(quoted, {});
  assert.equal(d.added.length, 1, 'quoted added path recognized');
  assert.equal(d.updated.length, 1, 'quoted modified path recognized');
  assert.ok(d.added[0].startsWith('knowledge/problem/PAIN-001-'));
  assert.ok(d.added[0].endsWith('.md'));
});

test('CLI --since reports Cyrillic-named notes in a real repo', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sd-cyr-'));
  try {
    const run = (cmd) => execSync(cmd, { cwd: dir, encoding: 'utf8' });
    run('git init -q');
    run('git config user.email t@t.t');
    run('git config user.name t');
    await mkdir(join(dir, 'knowledge', 'problem'), { recursive: true });
    // Cyrillic filename — the real-world case the ASCII fixtures missed.
    await writeFile(join(dir, 'knowledge', 'problem', 'PAIN-001-складність.md'), '# x', 'utf8');
    await writeFile(join(dir, 'knowledge', 'problem', 'PAIN-002-барєр.md'), '# y', 'utf8');
    run('git add -A');
    run('git commit -q -m seed');
    const out = execSync(`node "${CLI}" --since "2000-01-01"`, { cwd: dir, encoding: 'utf8' });
    const j = JSON.parse(out);
    assert.equal(j.added.length, 2, `expected 2 Cyrillic notes, got ${j.added.length}: ${out}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
