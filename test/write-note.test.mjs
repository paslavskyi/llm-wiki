import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { writeNote, buildSupersededIndex } from '../tools/write-note.mjs';
import { readNote } from '../lib/note.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const intent = (over = {}) => ({
  frontmatter: { id: 'FR-007', type: 'requirement', title: 'Create budget',
    status: 'draft', summary: 'S', priority: 'must', category: 'functional', ...over },
  body: 'Body.',
});

test('create: writes a new healthy note at target', async () => {
  const dir = await makeTmpDir();
  try {
    const target = join(dir, 'knowledge/product/requirements/FR-007-create-budget.md');
    const res = await writeNote(dir, target, intent());
    assert.equal(res.created, true);
    const note = await readNote(target);
    assert.equal(note.frontmatter.id, 'FR-007');
    assert.equal(note.frontmatter.updated, note.frontmatter.created); // first write
  } finally { await cleanup(dir); }
});

test('update: overwrites target, preserves created', async () => {
  const dir = await makeTmpDir();
  try {
    const target = join(dir, 'knowledge/product/requirements/FR-007-x.md');
    await writeFileDeep(target,
      `---\nid: FR-007\ntype: requirement\ntitle: Old\nstatus: draft\nsummary: S\npriority: must\ncategory: functional\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\nOld.\n`);
    const res = await writeNote(dir, target, intent({ title: 'New title' }));
    assert.equal(res.created, false);
    const note = await readNote(target);
    assert.equal(note.frontmatter.title, 'New title');
    assert.equal(note.frontmatter.created, '2026-01-01'); // preserved
  } finally { await cleanup(dir); }
});

test('local-validate failure: target untouched, no temp left behind', async () => {
  const dir = await makeTmpDir();
  try {
    const target = join(dir, 'knowledge/product/requirements/FR-007-x.md');
    await writeFileDeep(target,
      `---\nid: FR-007\ntype: requirement\ntitle: Keep\nstatus: draft\nsummary: S\npriority: must\ncategory: functional\n---\nKeep.\n`);
    // invalid: priority not in enum → schema rejects
    await assert.rejects(() => writeNote(dir, target, intent({ priority: 'urgent' })));
    const note = await readNote(target);
    assert.equal(note.frontmatter.title, 'Keep'); // untouched
    const dirFiles = await readdir(join(dir, 'knowledge/product/requirements'));
    assert.ok(!dirFiles.some(f => f.includes('.tmp')), 'no temp file remains');
  } finally { await cleanup(dir); }
});

test('buildSupersededIndex maps deprecated id → superseded_by', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/requirements/FR-001-old.md'),
      `---\nid: FR-001\ntype: requirement\ntitle: Old\nstatus: deprecated\nsummary: S\npriority: must\ncategory: functional\nsuperseded_by: FR-002\n---\n`);
    const idx = await buildSupersededIndex(dir);
    assert.equal(idx.get('FR-001'), 'FR-002');
  } finally { await cleanup(dir); }
});

test('B6: raw file has id as the first frontmatter key, in KEY_ORDER', async () => {
  const dir = await makeTmpDir();
  try {
    const target = join(dir, 'knowledge/product/requirements/FR-007-create-budget.md');
    await writeNote(dir, target, intent({ links: ['JTBD-1'] }), { today: '2026-05-30' });
    const raw = await readFile(target, 'utf8');
    const fmBlock = raw.split('---')[1];
    const keys = fmBlock.split('\n')
      .map(l => l.match(/^([A-Za-z_][\w-]*):/))
      .filter(Boolean)
      .map(m => m[1]);
    assert.equal(keys[0], 'id', 'id must be the first frontmatter key in the raw file');
    assert.ok(keys.indexOf('type') < keys.indexOf('summary'), 'type before summary');
    assert.ok(keys.indexOf('created') < keys.indexOf('updated'), 'created before updated');
    assert.ok(keys.includes('updated'));
  } finally { await cleanup(dir); }
});

test('round-trip: written dates are plain YYYY-MM-DD strings', async () => {
  const dir = await makeTmpDir();
  try {
    const target = join(dir, 'knowledge/product/requirements/FR-007-x.md');
    await writeNote(dir, target, intent(), { today: '2026-05-30' });
    const note = await readNote(target);
    assert.equal(note.frontmatter.created, '2026-05-30');
    assert.equal(note.frontmatter.updated, '2026-05-30');
    assert.equal(typeof note.frontmatter.created, 'string');
  } finally { await cleanup(dir); }
});
