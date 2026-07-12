import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../lib/heal.mjs';

test('short titles are untouched', () => {
  assert.equal(slugify('Local-first / self-hosted'), 'local-first-self-hosted');
});

test('long titles are capped at a hyphen boundary under 81 chars', () => {
  const long = 'дуже '.repeat(40) + 'довгий заголовок нотатки який раніше ламав windows max path';
  const slug = slugify(long);
  assert.ok(slug.length <= 80, `len ${slug.length}`);
  assert.ok(!slug.endsWith('-'));
  assert.ok(!slug.includes('--'));
});

test('a single 100-char word is hard-cut to the cap', () => {
  const slug = slugify('a'.repeat(100));
  assert.equal(slug.length, 80);
});
