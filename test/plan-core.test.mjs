import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPlanOp, deriveDoneEvents, planUnion } from '../lib/plan-core.mjs';

const base = () => ({ active: ['A'], queue: ['B', 'C', 'D'], backlog: ['E'] });

test('take moves explicit id from queue to active', () => {
  const { lists, message } = applyPlanOp(base(), { verb: 'take', id: 'C' });
  assert.deepEqual(lists.active, ['A', 'C']);
  assert.deepEqual(lists.queue, ['B', 'D']);
  assert.equal(message, 'plan: take C');
});

test('take without id takes the queue head', () => {
  const { lists } = applyPlanOp(base(), { verb: 'take' });
  assert.deepEqual(lists.active, ['A', 'B']);
  assert.deepEqual(lists.queue, ['C', 'D']);
});

test('take on empty queue without id throws', () => {
  assert.throws(() => applyPlanOp({ active: [], queue: [], backlog: [] }, { verb: 'take' }), /queue is empty/);
});

test('done removes from all lists and message marks completion', () => {
  const { lists, message } = applyPlanOp(base(), { verb: 'done', id: 'A' });
  assert.deepEqual(lists.active, []);
  assert.equal(message, 'plan: A done');
});

test('done on unknown id throws', () => {
  assert.throws(() => applyPlanOp(base(), { verb: 'done', id: 'X' }), /not in the plan/);
});

test('drop removes and message starts with "plan: drop"', () => {
  const { lists, message } = applyPlanOp(base(), { verb: 'drop', id: 'E' });
  assert.deepEqual(lists.backlog, []);
  assert.ok(message.startsWith('plan: drop'));
});

test('defer parks anything (including a new id) to backlog', () => {
  const { lists } = applyPlanOp(base(), { verb: 'defer', id: 'B' });
  assert.deepEqual(lists.queue, ['C', 'D']);
  assert.deepEqual(lists.backlog, ['E', 'B']);
  const { lists: l2 } = applyPlanOp(base(), { verb: 'defer', id: 'NEW-1' });
  assert.ok(l2.backlog.includes('NEW-1'));
});

test('promote inserts at 1-based position and pulls from backlog', () => {
  const { lists } = applyPlanOp(base(), { verb: 'promote', id: 'E', pos: 1 });
  assert.deepEqual(lists.queue, ['E', 'B', 'C', 'D']);
  assert.deepEqual(lists.backlog, []);
});

test('promote without pos appends', () => {
  const { lists } = applyPlanOp(base(), { verb: 'promote', id: 'G' });
  assert.deepEqual(lists.queue, ['B', 'C', 'D', 'G']);
});

test('move reorders within the queue', () => {
  const { lists } = applyPlanOp(base(), { verb: 'move', id: 'D', pos: 1 });
  assert.deepEqual(lists.queue, ['D', 'B', 'C']);
});

test('move of a non-queue id throws', () => {
  assert.throws(() => applyPlanOp(base(), { verb: 'move', id: 'A', pos: 1 }), /not in the queue/);
});

test('set replaces lists and enforces disjointness (active > queue > backlog)', () => {
  const { lists } = applyPlanOp(base(), {
    verb: 'set',
    lists: { active: ['X'], queue: ['X', 'Y', 'Y'], backlog: ['Y', 'Z'] },
  });
  assert.deepEqual(lists.active, ['X']);
  assert.deepEqual(lists.queue, ['Y']);
  assert.deepEqual(lists.backlog, ['Z']);
});

test('set with partial lists keeps the others', () => {
  const { lists } = applyPlanOp(base(), { verb: 'set', lists: { queue: ['Q1', 'Q2'] } });
  assert.deepEqual(lists.active, ['A']);
  assert.deepEqual(lists.queue, ['Q1', 'Q2']);
  assert.deepEqual(lists.backlog, ['E']);
});

test('ops never leave an id in two lists', () => {
  let lists = base();
  for (const op of [
    { verb: 'promote', id: 'E', pos: 2 },
    { verb: 'take', id: 'E' },
    { verb: 'defer', id: 'E' },
  ]) {
    lists = applyPlanOp(lists, op).lists;
    const all = [...lists.active, ...lists.queue, ...lists.backlog];
    assert.equal(all.length, planUnion(lists).size, `duplicate after ${op.verb}`);
  }
});

test('unknown verb throws', () => {
  assert.throws(() => applyPlanOp(base(), { verb: 'zap' }), /unknown verb/);
});

// ── deriveDoneEvents ──────────────────────────────────────────────────

const rev = (hash, date, subject, lists) => ({ hash, date, subject, lists });

test('id leaving the union is done; drop-subject marks dropped', () => {
  const { done, dropped } = deriveDoneEvents([
    rev('h1', '2026-07-01', 'plan: set lists', { active: ['A'], queue: ['B', 'C'], backlog: [] }),
    rev('h2', '2026-07-02', 'plan: A done', { active: [], queue: ['B', 'C'], backlog: [] }),
    rev('h3', '2026-07-03', 'plan: drop C', { active: [], queue: ['B'], backlog: [] }),
  ]);
  assert.deepEqual(done, [{ id: 'A', date: '2026-07-02', hash: 'h2' }]);
  assert.deepEqual(dropped, [{ id: 'C', date: '2026-07-03', hash: 'h3' }]);
});

test('moves between lists are not done-events', () => {
  const { done, dropped } = deriveDoneEvents([
    rev('h1', '2026-07-01', 'plan: set lists', { active: [], queue: ['B'], backlog: [] }),
    rev('h2', '2026-07-02', 'plan: take B', { active: ['B'], queue: [], backlog: [] }),
    rev('h3', '2026-07-03', 'plan: defer B', { active: [], queue: [], backlog: ['B'] }),
  ]);
  assert.equal(done.length, 0);
  assert.equal(dropped.length, 0);
});

test('empty or single revision yields no events', () => {
  assert.deepEqual(deriveDoneEvents([]), { done: [], dropped: [] });
  assert.deepEqual(
    deriveDoneEvents([rev('h1', '2026-07-01', 'x', { active: ['A'], queue: [], backlog: [] })]),
    { done: [], dropped: [] },
  );
});

test('done events come back newest first', () => {
  const { done } = deriveDoneEvents([
    rev('h1', '2026-07-01', 's', { active: ['A', 'B'], queue: [], backlog: [] }),
    rev('h2', '2026-07-02', 'plan: A done', { active: ['B'], queue: [], backlog: [] }),
    rev('h3', '2026-07-03', 'plan: B done', { active: [], queue: [], backlog: [] }),
  ]);
  assert.deepEqual(done.map(e => e.id), ['B', 'A']);
});
