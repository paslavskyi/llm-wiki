import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healNote, resolveSupersede, slugify } from '../lib/heal.mjs';

const base = {
  frontmatter: { id: 'FR-007', type: 'requirement', title: 'Create monthly budget',
    status: 'draft', summary: 'S', priority: 'must', category: 'functional' },
  body: 'Body.',
};
const ctx = () => ({ existing: null, supersededIndex: new Map(), today: '2026-05-30' });

test('A: id is preserved, slug derives from title', () => {
  const { frontmatter } = healNote(base, ctx());
  assert.equal(frontmatter.id, 'FR-007');
  assert.equal(slugify('Create monthly budget'), 'create-monthly-budget');
});

test('B: missing required field throws', () => {
  const bad = { frontmatter: { id: 'FR-008', type: 'requirement' }, body: '' };
  assert.throws(() => healNote(bad, ctx()), /required|missing/i);
});

test('B: updated set to today; created preserved from existing', () => {
  const c = { ...ctx(), existing: { frontmatter: { ...base.frontmatter, created: '2026-01-01' } } };
  const { frontmatter } = healNote(base, c);
  assert.equal(frontmatter.updated, '2026-05-30');
  assert.equal(frontmatter.created, '2026-01-01');
});

test('B: created defaults to today on first write', () => {
  const { frontmatter } = healNote(base, ctx());
  assert.equal(frontmatter.created, '2026-05-30');
});

test('C7: transitive supersede resolution to live head', () => {
  const idx = new Map([['AB-1', 'CD-2'], ['CD-2', 'EF-3']]);
  assert.equal(resolveSupersede('AB-1', idx), 'EF-3');
});

test('C7: cyclic supersede chain returns input, does not loop', () => {
  const idx = new Map([['P', 'Q'], ['Q', 'P']]);
  assert.equal(resolveSupersede('P', idx), 'P');
});

test('C7: links healed from deprecated to live head', () => {
  const withLink = { ...base, frontmatter: { ...base.frontmatter, links: ['AB-1'] } };
  const c = { ...ctx(), supersededIndex: new Map([['AB-1', 'CD-2']]) };
  const { frontmatter } = healNote(withLink, c);
  assert.deepEqual(frontmatter.links, ['CD-2']);
});

test('C8: links deduplicated preserving first-seen order', () => {
  const dup = { ...base, frontmatter: { ...base.frontmatter, links: ['JTBD-1', 'JTBD-2', 'JTBD-1'] } };
  const { frontmatter } = healNote(dup, ctx());
  assert.deepEqual(frontmatter.links, ['JTBD-1', 'JTBD-2']);
});

test('C9: self-reference removed from links', () => {
  const selfRef = { ...base, frontmatter: { ...base.frontmatter, links: ['FR-007', 'JTBD-1'] } };
  const { frontmatter } = healNote(selfRef, ctx());
  assert.deepEqual(frontmatter.links, ['JTBD-1']);
});

test('D: unknown frontmatter fields and body preserved verbatim', () => {
  const extra = { frontmatter: { ...base.frontmatter, customField: 'keep-me', tags: ['a'] }, body: 'Rich body [[JTBD-1]]' };
  const { frontmatter, body } = healNote(extra, ctx());
  assert.equal(frontmatter.customField, 'keep-me');
  assert.deepEqual(frontmatter.tags, ['a']);
  assert.equal(body, 'Rich body [[JTBD-1]]');
});

test('B6: frontmatter key order is deterministic (id first, updated near id block)', () => {
  const { frontmatter } = healNote(base, ctx());
  const keys = Object.keys(frontmatter);
  assert.equal(keys[0], 'id');
  assert.ok(keys.indexOf('type') < keys.indexOf('summary'));
});

test('healNote: returned frontmatter shares no array references with input intent', () => {
  const inputTags = ['a', 'b'];
  const withTags = { ...base, frontmatter: { ...base.frontmatter, tags: inputTags } };
  const { frontmatter } = healNote(withTags, ctx());
  // mutating the RETURNED tags must not affect the original intent
  frontmatter.tags.push('c');
  assert.equal(inputTags.length, 2, 'original intent tags must be unchanged');
  // and mutating the INPUT array after the call must not affect the returned object
  inputTags.push('d');
  assert.equal(frontmatter.tags.length, 3, 'returned tags must not reflect later input mutation');
});

test('healNote: topic with parent:null (top-level) is valid, not "missing"', () => {
  const note = {
    frontmatter: { id: 'TOP-001', type: 'topic', title: 'Проблема',
      status: 'accepted', summary: 'S', parent: null },
    body: 'Area.',
  };
  const ctx = { existing: null, supersededIndex: new Map(), today: '2026-05-31' };
  const { frontmatter } = healNote(note, ctx);
  assert.equal(frontmatter.id, 'TOP-001');
  assert.equal(frontmatter.parent, null);
});

test('healNote: topic with parent key absent still throws (truly missing)', () => {
  const note = {
    frontmatter: { id: 'TOP-009', type: 'topic', title: 'X', status: 'draft', summary: 'S' },
    body: '',
  };
  const ctx = { existing: null, supersededIndex: new Map(), today: '2026-05-31' };
  assert.throws(() => healNote(note, ctx), /parent/);
});
