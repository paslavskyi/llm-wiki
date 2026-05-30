import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { buildHealth } from '../tools/graph.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const note = (fm, body = '') => {
  const lines = Object.entries(fm).map(([k, v]) =>
    Array.isArray(v) ? `${k}: [${v.join(', ')}]` : `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n${body}\n`;
};

test('tier1: migration debt — incoming link to a deprecated note', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/requirements/FR-001-old.md'),
      note({ id: 'FR-001', type: 'requirement', title: 'Old', status: 'deprecated',
             summary: 'old', priority: 'must', category: 'functional', superseded_by: 'FR-002' }));
    await writeFileDeep(join(dir, 'knowledge/product/requirements/FR-002-new.md'),
      note({ id: 'FR-002', type: 'requirement', title: 'New', status: 'draft',
             summary: 'new', priority: 'must', category: 'functional' }));
    await writeFileDeep(join(dir, 'knowledge/product/features/FEAT-001-x.md'),
      note({ id: 'FEAT-001', type: 'feature', title: 'X', status: 'draft',
             summary: 'x', links: ['FR-001'] }));
    const { markdown } = await buildHealth(dir, {});
    assert.match(markdown, /[Mm]igration debt/);
    assert.match(markdown, /FEAT-001/);
    assert.match(markdown, /FR-001/);
  } finally { await cleanup(dir); }
});

test('tier1: open questions/risks/assumptions (status != accepted)', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/Q-001-open.md'),
      note({ id: 'Q-001', type: 'question', title: 'Open?', status: 'draft', summary: 'q' }));
    await writeFileDeep(join(dir, 'knowledge/product/Q-002-done.md'),
      note({ id: 'Q-002', type: 'question', title: 'Done?', status: 'accepted', summary: 'q' }));
    const { markdown } = await buildHealth(dir, {});
    assert.match(markdown, /Q-001/);
    assert.ok(!markdown.includes('Q-002'), 'accepted question is not open');
  } finally { await cleanup(dir); }
});

test('tier1: empty topic node (no attached notes)', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/vision/TOP-001-vision.md'),
      note({ id: 'TOP-001', type: 'topic', title: 'Vision', status: 'draft', summary: 'v', parent: 'null' }));
    const { markdown } = await buildHealth(dir, {});
    assert.match(markdown, /[Ee]mpty topic/);
    assert.match(markdown, /TOP-001/);
  } finally { await cleanup(dir); }
});

test('tier2: orphan concrete note (no links, no backlinks)', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/product/ENT-001-lonely.md'),
      note({ id: 'ENT-001', type: 'entity', title: 'Lonely', status: 'draft', summary: 'e' }));
    const { markdown } = await buildHealth(dir, {});
    assert.match(markdown, /[Oo]rphan/);
    assert.match(markdown, /ENT-001/);
  } finally { await cleanup(dir); }
});

test('duplicates: off by default, on when enabled', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/users/PER-001-a.md'),
      note({ id: 'PER-001', type: 'persona', title: 'Busy parent', status: 'draft', summary: 'p' }));
    await writeFileDeep(join(dir, 'knowledge/users/PER-002-b.md'),
      note({ id: 'PER-002', type: 'persona', title: 'Busy parnt', status: 'draft', summary: 'p' }));
    const off = await buildHealth(dir, { duplicates: false });
    assert.ok(!/[Pp]ossible duplicate/.test(off.markdown));
    const on = await buildHealth(dir, { duplicates: true, threshold: 0.92 });
    assert.match(on.markdown, /[Pp]ossible duplicate/);
    assert.match(on.markdown, /PER-001/);
    assert.match(on.markdown, /PER-002/);
  } finally { await cleanup(dir); }
});

test('duplicates: punctuation-only titles (normalize to "") are NOT false duplicates', async () => {
  const dir = await makeTmpDir();
  try {
    // Titles are quoted YAML strings (valid YAML) that are pure punctuation, so
    // normalizeForCompare() reduces both to '' — the empty-vs-empty case that
    // jaroWinkler scores 1.0. Unique summaries (nonce) dodge gray-matter's
    // in-process content cache.
    const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2);
    await writeFileDeep(join(dir, 'knowledge/users/PER-101-a.md'),
      note({ id: 'PER-101', type: 'persona', title: '"---"', status: 'draft', summary: `a-${nonce}` }));
    await writeFileDeep(join(dir, 'knowledge/users/PER-102-b.md'),
      note({ id: 'PER-102', type: 'persona', title: '"..."', status: 'draft', summary: `b-${nonce}` }));
    const on = await buildHealth(dir, { duplicates: true, threshold: 0.92 });
    assert.ok(!/PER-101 ~ PER-102/.test(on.markdown),
      'punctuation-only titles must not be reported as duplicates');
  } finally { await cleanup(dir); }
});

test('duplicates: near-identical Cyrillic titles ARE reported when enabled', async () => {
  const dir = await makeTmpDir();
  try {
    const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2);
    await writeFileDeep(join(dir, 'knowledge/users/PER-201-a.md'),
      note({ id: 'PER-201', type: 'persona', title: 'Зайнятий батько', status: 'draft', summary: `a-${nonce}` }));
    await writeFileDeep(join(dir, 'knowledge/users/PER-202-b.md'),
      note({ id: 'PER-202', type: 'persona', title: 'Зайнятий батьк', status: 'draft', summary: `b-${nonce}` }));
    const on = await buildHealth(dir, { duplicates: true, threshold: 0.92 });
    assert.match(on.markdown, /[Pp]ossible duplicate/);
    assert.match(on.markdown, /PER-201/);
    assert.match(on.markdown, /PER-202/);
  } finally { await cleanup(dir); }
});

test('health.md has GENERATED banner and is exit-0 friendly (returns string)', async () => {
  const dir = await makeTmpDir();
  try {
    const { markdown } = await buildHealth(dir, {});
    assert.match(markdown, /GENERATED/);
  } finally { await cleanup(dir); }
});
