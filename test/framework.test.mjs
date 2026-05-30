import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('kb.framework.yml parses and has well-formed areas', async () => {
  const raw = await readFile(join(root, 'kb.framework.yml'), 'utf8');
  const doc = yaml.load(raw);
  assert.ok(Array.isArray(doc.areas) && doc.areas.length > 0);
  for (const area of doc.areas) {
    assert.equal(typeof area.key, 'string');
    assert.equal(typeof area.title, 'string');
    assert.ok(Array.isArray(area.framing));
    assert.ok(area.framing.every(q => typeof q === 'string'));
  }
});
