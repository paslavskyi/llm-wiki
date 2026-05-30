import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { walkMarkdown } from '../lib/walk.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

test('walkMarkdown finds nested .md files, ignores others, sorted', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'a.md'), 'a');
    await writeFileDeep(join(dir, 'sub', 'b.md'), 'b');
    await writeFileDeep(join(dir, 'sub', 'note.txt'), 'ignored');
    const found = await walkMarkdown(dir);
    assert.deepEqual(found, [join(dir, 'a.md'), join(dir, 'sub', 'b.md')]);
  } finally {
    await cleanup(dir);
  }
});

test('walkMarkdown returns [] for a missing directory', async () => {
  const found = await walkMarkdown('/no/such/dir/xyz');
  assert.deepEqual(found, []);
});
