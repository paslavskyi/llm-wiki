import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseState, monthlyTrend, planMembership, isDoneItem,
  computeGoals, computeTimeline, computeTechdebt,
} from '../lib/dashboard-data.mjs';

const note = (id, type, status, extra = {}) => ({
  id, type, status, title: id, summary: '', tags: [], ...extra,
});
const byIdOf = (...notes) => new Map(notes.map(n => [n.id, n]));

// ── isDoneItem: completion is type-specific ─────────────────────────

test('accepted milestone/risk/question/assumption count as done', () => {
  const none = new Set();
  for (const t of ['milestone', 'risk', 'question', 'assumption']) {
    assert.ok(isDoneItem(note('X-1', t, 'accepted'), none), t);
  }
});

test('accepted feature/requirement is NOT done (accepted = agreed, not shipped)', () => {
  const none = new Set();
  assert.ok(!isDoneItem(note('FEAT-1', 'feature', 'accepted'), none));
  assert.ok(!isDoneItem(note('FR-1', 'requirement', 'accepted'), none));
});

test('any type is done once the plan history says so', () => {
  assert.ok(isDoneItem(note('FEAT-1', 'feature', 'accepted'), new Set(['FEAT-1'])));
});

// ── computeGoals ─────────────────────────────────────────────────────

test('goal progress counts type-aware done and plan breakdown', () => {
  const mil = note('MIL-1', 'milestone', 'accepted');
  const feat = note('FEAT-1', 'feature', 'accepted');
  const risk = note('RISK-1', 'risk', 'proposed');
  const goal = note('GOAL-1', 'goal', 'accepted', { scope: ['MIL-1', 'FEAT-1', 'RISK-1'] });
  const membership = new Map([['FEAT-1', 'queue'], ['RISK-1', 'backlog']]);
  const [g] = computeGoals([goal], { byId: byIdOf(mil, feat, risk, goal), membership, doneInPlan: new Set() });
  assert.deepEqual(g.progress, { done: 1, total: 3 }); // only the milestone
  assert.deepEqual(g.planBreakdown, { active: 0, queue: 1, backlog: 1, done: 1 });
});

test('goal with empty scope has 0/0 progress', () => {
  const goal = note('GOAL-1', 'goal', 'accepted', { scope: [] });
  const [g] = computeGoals([goal], { byId: byIdOf(goal), membership: new Map(), doneInPlan: new Set() });
  assert.deepEqual(g.progress, { done: 0, total: 0 });
});

test('scope pointing at a missing note degrades gracefully', () => {
  const goal = note('GOAL-1', 'goal', 'accepted', { scope: ['GONE-9'] });
  const [g] = computeGoals([goal], { byId: byIdOf(goal), membership: new Map(), doneInPlan: new Set() });
  assert.equal(g.scope[0].id, 'GONE-9');
  assert.equal(g.scope[0].done, false);
});

// ── computeTimeline ──────────────────────────────────────────────────

const tlFixture = () => {
  const m1 = note('MIL-1', 'milestone', 'accepted');
  const m2 = note('MIL-2', 'milestone', 'proposed', { due: '2026-01-01' }); // past
  const m3 = note('MIL-3', 'milestone', 'proposed', { due: '2099-01-01' });
  const m4 = note('MIL-4', 'milestone', 'proposed');
  const tl = note('TL-1', 'timeline', 'accepted', { sequence: ['MIL-1', 'MIL-2', 'MIL-3', 'MIL-4'] });
  return { byId: byIdOf(m1, m2, m3, m4, tl), tl };
};

test('timeline derives done/overdue/planned and nowIndex', () => {
  const { byId, tl } = tlFixture();
  const t = computeTimeline(tl, { byId, activeSet: new Set(), doneInPlan: new Set(), today: '2026-07-12' });
  // the first not-done stage IS the overdue one — overdue outranks the
  // 'next' label, so no stage is labeled next here
  assert.deepEqual(t.stages.map(s => s.state), ['done', 'overdue', 'planned', 'planned']);
  assert.equal(t.nowIndex, 1); // «ми тут» after MIL-1
});

test('next labels the first not-done stage when it is not overdue', () => {
  const m1 = note('MIL-1', 'milestone', 'accepted');
  const m2 = note('MIL-2', 'milestone', 'proposed', { due: '2099-01-01' });
  const tl = note('TL-1', 'timeline', 'accepted', { sequence: ['MIL-1', 'MIL-2'] });
  const t = computeTimeline(tl, { byId: byIdOf(m1, m2, tl), activeSet: new Set(), doneInPlan: new Set(), today: '2026-07-12' });
  assert.deepEqual(t.stages.map(s => s.state), ['done', 'next']);
});

test('a stage in plan.active is inwork; overdue variant wins the label', () => {
  const { byId, tl } = tlFixture();
  const t = computeTimeline(tl, { byId, activeSet: new Set(['MIL-2', 'MIL-3']), doneInPlan: new Set(), today: '2026-07-12' });
  assert.equal(t.stages[1].state, 'inwork-overdue');
  assert.equal(t.stages[2].state, 'inwork');
});

test('all stages done puts «ми тут» past the end; none done at the start', () => {
  const m1 = note('MIL-1', 'milestone', 'accepted');
  const tl1 = note('TL-1', 'timeline', 'accepted', { sequence: ['MIL-1'] });
  const done = computeTimeline(tl1, { byId: byIdOf(m1, tl1), activeSet: new Set(), doneInPlan: new Set(), today: '2026-07-12' });
  assert.equal(done.nowIndex, 1);

  const m2 = note('MIL-2', 'milestone', 'proposed');
  const tl2 = note('TL-2', 'timeline', 'accepted', { sequence: ['MIL-2'] });
  const fresh = computeTimeline(tl2, { byId: byIdOf(m2, tl2), activeSet: new Set(), doneInPlan: new Set(), today: '2026-07-12' });
  assert.equal(fresh.nowIndex, 0);
});

test('no timeline note → null', () => {
  assert.equal(computeTimeline(null, { byId: new Map(), activeSet: new Set(), doneInPlan: new Set(), today: '2026-07-12' }), null);
});

// ── computeTechdebt ──────────────────────────────────────────────────

test('debt = open risks with debt or audit-* tags, grouped by debt tag', () => {
  const live = [
    note('RISK-1', 'risk', 'proposed', { tags: ['risk', 'security', 'data-loss'] }),
    note('RISK-2', 'risk', 'proposed', { tags: ['risk', 'audit-2026-07'] }),
    note('RISK-3', 'risk', 'accepted', { tags: ['risk', 'security'] }),   // closed
    note('RISK-4', 'risk', 'proposed', { tags: ['risk', 'ux'] }),          // not debt
    note('Q-1', 'question', 'proposed', { tags: ['security'] }),           // not a risk
  ];
  const { risks, byTag } = computeTechdebt(live);
  assert.deepEqual(risks.map(r => r.id), ['RISK-1', 'RISK-2']);
  assert.deepEqual(byTag, { security: ['RISK-1'], 'data-loss': ['RISK-1'] });
});

// ── parseState / monthlyTrend ────────────────────────────────────────

test('parseState extracts Phase, Current focus, and any Live tail section', () => {
  const s = parseState('# T\n\n## Phase\nA\n\n## Current focus\nB\nC\n\n## Live tail (post-WP-3)\nD\n');
  assert.equal(s.phase, 'A');
  assert.equal(s.focus, 'B\nC');
  assert.equal(s.liveTail, 'D');
});

test('monthlyTrend buckets created/updated by month and skips malformed dates', () => {
  const rows = monthlyTrend([
    { created: '2026-06-05', updated: '2026-07-01' },
    { created: '2026-07-11', updated: 'garbage' },
    { created: null, updated: '2026-07-12' },
  ]);
  assert.deepEqual(rows, [
    { month: '2026-06', created: 1, updated: 0 },
    { month: '2026-07', created: 1, updated: 2 },
  ]);
});

test('planMembership maps ids to their lane', () => {
  const m = planMembership({ active: ['A'], queue: ['B'], backlog: ['C'] });
  assert.equal(m.get('A'), 'active');
  assert.equal(m.get('B'), 'queue');
  assert.equal(m.get('C'), 'backlog');
  assert.equal(planMembership(null).size, 0);
});
