import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jaroWinkler, normalizeForCompare } from '../lib/jaro-winkler.mjs';

test('identical strings score 1', () => {
  assert.equal(jaroWinkler('budget', 'budget'), 1);
});

test('completely different strings score low', () => {
  assert.ok(jaroWinkler('budget', 'xyzzy') < 0.5);
});

test('near-exact titles score high (>= 0.92)', () => {
  assert.ok(jaroWinkler('create monthly budget', 'create monthy budget') >= 0.92);
});

test('common-prefix boosts score (Winkler)', () => {
  const jw = jaroWinkler('marhta', 'martha');
  assert.ok(jw > 0.96 && jw <= 1);
});

test('empty strings: two empties are equal, one empty is 0', () => {
  assert.equal(jaroWinkler('', ''), 1);
  assert.equal(jaroWinkler('abc', ''), 0);
});

test('normalizeForCompare lowercases, trims, collapses ws, strips punctuation', () => {
  assert.equal(normalizeForCompare('  Create,  Monthly  Budget! '), 'create monthly budget');
});

test('normalizeForCompare handles Cyrillic (lowercase + strip punct + collapse ws)', () => {
  assert.equal(normalizeForCompare('  Бюджет, на  Місяць! '), 'бюджет на місяць');
});

test('near-identical Cyrillic titles score high (>= 0.92)', () => {
  assert.ok(jaroWinkler('зайнятий батько', 'зайнятий батьк') >= 0.92);
});
