import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { buildMindmapHtml } from '../tools/mindmap-html.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

async function seed(dir) {
  await writeFileDeep(join(dir, 'knowledge/vision/TOP-001-vision.md'),
    `---\nid: TOP-001\ntype: topic\ntitle: Vision\nstatus: draft\nsummary: Area.\nparent: null\n---\n`);
  await writeFileDeep(join(dir, 'knowledge/vision/VIS-001-mission.md'),
    `---\nid: VIS-001\ntype: vision\ntitle: Mission\nstatus: draft\nsummary: M.\ntopic: TOP-001\n---\n`);
}

test('html is a self-contained document with inlined scripts', async () => {
  const dir = await makeTmpDir();
  try {
    await seed(dir);
    const html = await buildMindmapHtml(dir);
    assert.match(html, /<!DOCTYPE html>/i);
    assert.match(html, /<svg id="mindmap"/);
    assert.ok(!/src="https?:/.test(html), 'must not reference remote scripts');
  } finally { await cleanup(dir); }
});

test('html embeds the tree data with node titles', async () => {
  const dir = await makeTmpDir();
  try {
    await seed(dir);
    const html = await buildMindmapHtml(dir);
    assert.match(html, /Vision/);
    assert.match(html, /TOP-001/);
    assert.match(html, /VIS-001/);
    assert.match(html, /Mission/);
  } finally { await cleanup(dir); }
});

test('html generation is deterministic for the same input', async () => {
  const dir = await makeTmpDir();
  try {
    await seed(dir);
    const a = await buildMindmapHtml(dir);
    const b = await buildMindmapHtml(dir);
    assert.equal(a, b);
  } finally { await cleanup(dir); }
});

test('empty knowledge base still produces a valid document', async () => {
  const dir = await makeTmpDir();
  try {
    const html = await buildMindmapHtml(dir);
    assert.match(html, /<!DOCTYPE html>/i);
    assert.match(html, /<svg id="mindmap"/);
  } finally { await cleanup(dir); }
});
