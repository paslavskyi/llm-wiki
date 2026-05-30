import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../tools/should-commit.mjs';

const HOUR = 3600_000;
const cfg = (over = {}) => ({
  autocommit: 'manual', threshold: 10, max_age_hours: 24,
  remind_every_hours: 4, hard_safety_net: false, hard_threshold: 50, ...over,
});
const changes = (n) => Array.from({ length: n }, (_, i) => `knowledge/x/N-${i}.md`);

test('off → none regardless of changes', () => {
  const d = decide({ changes: changes(99), oldestDirtyMs: 0, lastRemindMs: null, now: 100 * HOUR, config: cfg({ autocommit: 'off' }) });
  assert.equal(d.level, 'none');
});

test('below thresholds → none', () => {
  const d = decide({ changes: changes(3), oldestDirtyMs: 99 * HOUR, lastRemindMs: null, now: 100 * HOUR, config: cfg() });
  assert.equal(d.level, 'none'); // 3 < 10 and age 1h < 24h
});

test('volume threshold crossed, manual → remind', () => {
  const d = decide({ changes: changes(12), oldestDirtyMs: 100 * HOUR, lastRemindMs: null, now: 100 * HOUR, config: cfg() });
  assert.equal(d.level, 'remind');
  assert.equal(d.count, 12);
});

test('age threshold crossed, auto → commit', () => {
  const d = decide({ changes: changes(2), oldestDirtyMs: 0, lastRemindMs: null, now: 30 * HOUR, config: cfg({ autocommit: 'auto' }) });
  assert.equal(d.level, 'commit'); // age 30h >= 24h
});

test('hard safety-net crosses hard_threshold → hard (even in auto)', () => {
  const d = decide({ changes: changes(60), oldestDirtyMs: 0, lastRemindMs: null, now: 0, config: cfg({ autocommit: 'auto', hard_safety_net: true }) });
  assert.equal(d.level, 'hard');
});

test('hard disabled → commit even past hard_threshold', () => {
  const d = decide({ changes: changes(60), oldestDirtyMs: 0, lastRemindMs: null, now: 0, config: cfg({ autocommit: 'auto', hard_safety_net: false }) });
  assert.equal(d.level, 'commit');
});
