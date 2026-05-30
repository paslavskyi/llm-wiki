import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('vendored d3 is present and non-trivial', async () => {
  const js = await readFile(join(root, 'tools/vendor/d3.min.js'), 'utf8');
  assert.ok(js.length > 10000, 'd3.min.js should be a real build');
});

test('vendored markmap-view is present and references markmap', async () => {
  const js = await readFile(join(root, 'tools/vendor/markmap-view.min.js'), 'utf8');
  assert.ok(js.length > 10000, 'markmap-view.min.js should be a real build');
  assert.match(js, /markmap/i, 'should reference the markmap global');
});
