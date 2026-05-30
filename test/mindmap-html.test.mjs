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

test('a note title containing </script> cannot break out of the script block', async () => {
  const dir = await makeTmpDir();
  try {
    // Unique nonce defeats gray-matter's in-process content cache.
    const nonce = `nonce-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await writeFileDeep(join(dir, 'knowledge/vision/TOP-001-vision.md'),
      `---\nid: TOP-001\ntype: topic\ntitle: Vision\nstatus: draft\nsummary: ${nonce}\nparent: null\n---\n`);
    await writeFileDeep(join(dir, 'knowledge/vision/VIS-001-evil.md'),
      `---\nid: VIS-001\ntype: vision\ntitle: "Embed a </script> tag"\nstatus: draft\nsummary: ${nonce}-x\ntopic: TOP-001\n---\n`);

    const html = await buildMindmapHtml(dir);

    // The template emits exactly 3 legitimate closing </script> tags
    // (vendored d3 + vendored markmap-view + the render script). The
    // malicious title must NOT contribute a 4th.
    const closing = (html.match(/<\/script>/g) || []).length;
    assert.equal(closing, 3, 'malicious title must not add a closing </script> tag');

    // The title must be preserved in escaped form, not dropped.
    assert.ok(html.includes('\\u003c/script'), 'title </script> must be escaped, not removed');
  } finally { await cleanup(dir); }
});
