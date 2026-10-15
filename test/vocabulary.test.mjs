import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { checkVocabulary, VOCABULARY } from '../lib/vocabulary.mjs';
import { validateNotes } from '../tools/validate.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const fm = (id, type) => ({ id, type, title: 't', status: 'draft', summary: 's' });

test('vocabulary: matching type, prefix and domain pass', () => {
  assert.deepEqual(checkVocabulary(fm('PER-001', 'persona'), 'users'), []);
  assert.deepEqual(checkVocabulary(fm('FR-001', 'requirement'), 'product'), []);
  assert.deepEqual(checkVocabulary(fm('DEC-001', 'decision'), 'decisions'), []);
});

test('vocabulary: unknown type is rejected', () => {
  const errs = checkVocabulary(fm('FOO-1', 'banana'), 'product');
  assert.equal(errs.length, 1);
  assert.match(errs[0], /unknown type "banana"/);
});

test('vocabulary: id prefix must match the type', () => {
  const errs = checkVocabulary(fm('FR-999', 'persona'), 'users');
  assert.equal(errs.length, 1);
  assert.match(errs[0], /prefix "FR" does not match type "persona" \(expected PER-\)/);
});

test('vocabulary: note must live in its type\'s domain folder', () => {
  const errs = checkVocabulary(fm('PER-001', 'persona'), 'product');
  assert.equal(errs.length, 1);
  assert.match(errs[0], /type "persona" belongs in knowledge\/users\//);
});

test('vocabulary: topic and cross-cutting types may live in any domain', () => {
  for (const [id, type] of [['TOP-001', 'topic'], ['RISK-001', 'risk'], ['ASMP-001', 'assumption'], ['Q-001', 'question']]) {
    assert.deepEqual(checkVocabulary(fm(id, type), 'vision'), []);
    assert.deepEqual(checkVocabulary(fm(id, type), 'product'), []);
  }
});

test('vocabulary: requirement accepts FR- and NFR-, nfr only NFR-', () => {
  assert.deepEqual(checkVocabulary(fm('NFR-001', 'requirement'), 'product'), []);
  assert.equal(checkVocabulary(fm('FR-001', 'nfr'), 'product').length, 1);
});

test('vocabulary: every type has at least one prefix', () => {
  for (const [type, entry] of Object.entries(VOCABULARY)) {
    assert.ok(entry.prefixes.length > 0, type);
  }
});

test('validateNotes reports a prefix/type mismatch', async () => {
  const dir = await makeTmpDir();
  try {
    await writeFileDeep(join(dir, 'knowledge/users/FR-999-x.md'),
      '---\nid: FR-999\ntype: persona\ntitle: X\nstatus: draft\nsummary: s\n---\n');
    const { errors } = await validateNotes(dir);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /^FR-999: id prefix "FR"/);
  } finally {
    await cleanup(dir);
  }
});
