import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readNote, extractLinks } from '../lib/note.mjs';
import { domainOf } from '../lib/domain.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

test('extractLinks merges frontmatter links and inline [[ID]], deduped', () => {
  const fm = { links: ['JTBD-002', 'FEAT-003'] };
  const body = 'see [[FEAT-003]] and [[NFR-005]] for details';
  assert.deepEqual(extractLinks(fm, body).sort(),
    ['FEAT-003', 'JTBD-002', 'NFR-005']);
});

test('extractLinks tolerates missing/empty links field', () => {
  assert.deepEqual(extractLinks({}, 'no links here'), []);
});

test('readNote parses frontmatter, body, and links', async () => {
  const dir = await makeTmpDir();
  try {
    const file = join(dir, 'FR-001-budget.md');
    await writeFileDeep(file,
      '---\nid: FR-001\ntype: requirement\nlinks: [JTBD-002]\n---\nBody [[FEAT-003]]\n');
    const note = await readNote(file);
    assert.equal(note.frontmatter.id, 'FR-001');
    assert.equal(note.fileName, 'FR-001-budget.md');
    assert.equal(note.body.trim(), 'Body [[FEAT-003]]');
    assert.deepEqual(note.links.sort(), ['FEAT-003', 'JTBD-002']);
  } finally {
    await cleanup(dir);
  }
});

test('domainOf returns top-level knowledge folder', () => {
  assert.equal(domainOf('knowledge/vision/VIS-001-x.md'), 'vision');
  assert.equal(domainOf('knowledge/product/requirements/FR-001-x.md'), 'product');
  assert.equal(domainOf('/abs/knowledge/gtm/POS-001-x.md'), 'gtm');
});

test('domainOf returns "unknown" when not under knowledge/', () => {
  assert.equal(domainOf('docs/foo.md'), 'unknown');
});
