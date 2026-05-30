import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { ageHours, nextMarkerState, shouldRemind, readMarker } from '../lib/dirty-marker.mjs';
import { makeTmpDir, writeFileDeep, cleanup } from './helpers.mjs';

const HOUR = 3600_000;

test('ageHours computes hours between two epoch-ms values', () => {
  assert.equal(ageHours(0, 5 * HOUR), 5);
  assert.equal(ageHours(2 * HOUR, 5 * HOUR), 3);
});

test('nextMarkerState: clean tree clears the marker', () => {
  assert.equal(nextMarkerState({ dirty: false, existing: 1234, now: 9999 }), null);
});

test('nextMarkerState: dirty with no marker sets now', () => {
  assert.equal(nextMarkerState({ dirty: true, existing: null, now: 9999 }), 9999);
});

test('nextMarkerState: dirty with existing marker keeps it (oldest wins)', () => {
  assert.equal(nextMarkerState({ dirty: true, existing: 1234, now: 9999 }), 1234);
});

test('shouldRemind: true when never reminded', () => {
  assert.equal(shouldRemind({ lastRemind: null, now: 9999, everyHours: 4 }), true);
});

test('shouldRemind: false within the debounce window', () => {
  assert.equal(shouldRemind({ lastRemind: 0, now: 3 * HOUR, everyHours: 4 }), false);
});

test('shouldRemind: true after the debounce window', () => {
  assert.equal(shouldRemind({ lastRemind: 0, now: 5 * HOUR, everyHours: 4 }), true);
});

test('readMarker: file containing "0" returns 0 (not null)', async () => {
  // Regression: the old `Number(...) || null` mapped a legit epoch 0 to null.
  const dir = await makeTmpDir();
  try {
    const path = join(dir, 'marker');
    await writeFileDeep(path, '0');
    assert.strictEqual(await readMarker(path), 0);
  } finally {
    await cleanup(dir);
  }
});

test('readMarker: missing file returns null', async () => {
  const dir = await makeTmpDir();
  try {
    assert.strictEqual(await readMarker(join(dir, 'does-not-exist')), null);
  } finally {
    await cleanup(dir);
  }
});

test('readMarker: garbage contents return null', async () => {
  const dir = await makeTmpDir();
  try {
    const path = join(dir, 'marker');
    await writeFileDeep(path, 'abc');
    assert.strictEqual(await readMarker(path), null);
  } finally {
    await cleanup(dir);
  }
});
