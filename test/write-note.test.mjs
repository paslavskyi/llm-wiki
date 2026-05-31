import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { writeNote, buildSupersededIndex, targetPathFor } from '../tools/write-note.mjs';
import { validateNotes } from '../tools/validate.mjs';
import { readNote } from '../lib/note.mjs';
import { assertNoDuplicateFrontmatterKeys, findDuplicateTopLevelKeys } from '../lib/frontmatter-keys.mjs';
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

test('rename-in-place: same id + new-slug target leaves exactly one file, no stale sibling', async () => {
  // Bug 1: when a note keeps its id but its title changes, callers compute a NEW
  // target path from the new slug (targetPathFor) and call writeNote. The new
  // file is written but the OLD-slug file for the same id used to linger on disk,
  // producing a "duplicate id" validation error (hit twice on ASMP-001).
  const dir = await makeTmpDir();
  try {
    const domain = join(dir, 'knowledge/product/requirements');
    // First write: title A -> FR-007-title-a.md
    const aPath = targetPathFor(dir, 'product/requirements', 'FR-007', 'Title A');
    await writeNote(dir, aPath, intent({ title: 'Title A' }), { today: '2026-05-30' });

    // Second write: changed title B -> new-slug target FR-007-title-b.md, but
    // we still pass the EXISTING content via existing-note merge. Callers always
    // pass the new-slug path here.
    const bPath = targetPathFor(dir, 'product/requirements', 'FR-007', 'Title B');
    // Seed the merge: writeNote reads existing at bPath (none) — to exercise the
    // real rename, we point the write at the new path while the old file exists.
    const res = await writeNote(dir, bPath, intent({ title: 'Title B' }), { today: '2026-05-31' });

    const files = (await readdir(domain)).filter(f => f.startsWith('FR-007') && f.endsWith('.md'));
    assert.deepEqual(files, ['FR-007-title-b.md'], `expected only the B-slug file, got: ${files.join(', ')}`);

    const note = await readNote(res.path);
    assert.equal(note.frontmatter.title, 'Title B');

    const { errors } = await validateNotes(dir);
    assert.ok(!errors.some(e => /duplicate id FR-007/i.test(e)),
      `unexpected duplicate-id error: ${JSON.stringify(errors)}`);
  } finally { await cleanup(dir); }
});

test('rename-in-place: Cyrillic title change removes old-slug sibling', async () => {
  // Same bug with non-ASCII (Cyrillic) filenames — the sweep must use Node fs,
  // not shell globbing.
  const dir = await makeTmpDir();
  try {
    const domain = join(dir, 'knowledge/product/requirements');
    const aPath = targetPathFor(dir, 'product/requirements', 'FR-007', 'Перше');
    await writeNote(dir, aPath, intent({ title: 'Перше' }), { today: '2026-05-30' });
    const bPath = targetPathFor(dir, 'product/requirements', 'FR-007', 'Друге');
    await writeNote(dir, bPath, intent({ title: 'Друге' }), { today: '2026-05-31' });

    const files = (await readdir(domain)).filter(f => f.startsWith('FR-007') && f.endsWith('.md'));
    assert.equal(files.length, 1, `expected exactly one FR-007 file, got: ${files.join(', ')}`);

    const { errors } = await validateNotes(dir);
    assert.ok(!errors.some(e => /duplicate id FR-007/i.test(e)),
      `unexpected duplicate-id error: ${JSON.stringify(errors)}`);
  } finally { await cleanup(dir); }
});

test('targetPathFor: empty slug (all-punctuation title) falls back to id', () => {
  const p = targetPathFor('/root', 'product', 'FR-007', '!!!');
  assert.ok(p.endsWith('FR-007-fr-007.md'), `expected fallback slug, got ${p}`);
});

test('targetPathFor: normal title still slugifies', () => {
  const p = targetPathFor('/root', 'product', 'FR-007', 'Create budget');
  assert.ok(p.endsWith('FR-007-create-budget.md'), `expected slugified path, got ${p}`);
});

// --- Bug 2: defense in depth against duplicate frontmatter keys ---

test('serialize-time guard throws on duplicate top-level key, accepts clean text', () => {
  const corrupt = '---\nid: FR-009\ntype: requirement\ntitle: First\ntitle: Second\n---\n\nbody\n';
  assert.ok(findDuplicateTopLevelKeys(corrupt).includes('title'));
  assert.throws(() => assertNoDuplicateFrontmatterKeys(corrupt), /duplicate frontmatter key/);

  const clean = '---\nid: FR-009\ntype: requirement\ntitle: Only\n---\n\nbody\n';
  assert.deepEqual(findDuplicateTopLevelKeys(clean), []);
  assert.doesNotThrow(() => assertNoDuplicateFrontmatterKeys(clean));
});

test('writeNote never produces a file with duplicate frontmatter keys', async () => {
  // The exact trigger of the one observed corruption is unconfirmed, so this is
  // defense in depth: a normal write must serialize cleanly (exactly one of each
  // top-level key) and the on-disk result must pass the raw duplicate-key scan.
  const dir = await makeTmpDir();
  try {
    const target = join(dir, 'knowledge/product/requirements/FR-007-x.md');
    const res = await writeNote(dir, target, intent({ title: 'A title' }), { today: '2026-05-30' });
    const raw = await readFile(res.path, 'utf8');
    assert.deepEqual(findDuplicateTopLevelKeys(raw), [], `output has duplicate keys:\n${raw}`);
    const titleLines = raw.split(/\r?\n/).filter(l => /^title:/.test(l));
    assert.equal(titleLines.length, 1, `expected exactly one title line, got ${titleLines.length}`);
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
