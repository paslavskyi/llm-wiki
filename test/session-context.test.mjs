import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionContext, summariseHealth } from '../lib/session-context.mjs';

const HEALTH = `# Health report
## Tier 1 — actionable
### Migration debt (links to deprecated notes)
_none_
### Open questions / risks / assumptions
- Q-001
- RISK-002
### Unresolved markers (inline clarifications / assumptions)
- FR-001 — 1 clarification, 0 assumption
## Tier 2 — may need attention (heuristic)
### Coverage gaps
- 7 gap(s) across 3 rule(s) — see index/coverage.md
### Orphan notes (no links in or out)
_none_
`;

const input = (over = {}) => ({
  config: { mode: 'debug', language: 'uk' },
  state: { focus: 'Budgeting MVP for families', next: 'Drill the users area' },
  domains: { users: 4, product: 9 },
  plan: { active: ['FEAT-001'], next: 'FEAT-003', queued: 4 },
  healthMd: HEALTH,
  budget: 1500,
  ...over,
});

test('summariseHealth: non-empty sections with counts; coverage uses its gap number', () => {
  assert.deepEqual(summariseHealth(HEALTH), [
    'Open questions / risks / assumptions: 2',
    'Unresolved markers: 1',
    'Coverage gaps: 7',
  ]);
});

test('buildSessionContext: state, plan, attention, domains and a size meter', () => {
  const out = buildSessionContext(input());
  assert.match(out, /^\[kb\] session snapshot — mode debug, language uk/);
  assert.match(out, /Focus: Budgeting MVP for families/);
  assert.match(out, /Next step: Drill the users area/);
  assert.match(out, /Plan: active FEAT-001 · next ready FEAT-003 · 4 queued/);
  assert.match(out, /Attention: Open questions \/ risks \/ assumptions: 2 · Unresolved markers: 1 · Coverage gaps: 7/);
  assert.match(out, /Notes: 13 \(product 9, users 4\)/);
  assert.match(out, /\[kb\] \d+\/1500 bytes · full picture: kb-orient · before writing a note: kb-capture\/formats\.md$/);
});

test('buildSessionContext: stays within budget by dropping low-priority blocks first', () => {
  const out = buildSessionContext(input({ budget: 380 }));
  assert.ok(Buffer.byteLength(out) <= 380, `${Buffer.byteLength(out)} bytes`);
  assert.match(out, /Focus:/);           // highest priority survives
  assert.doesNotMatch(out, /Notes: 13/); // lowest priority dropped
});

test('buildSessionContext: long STATE text is clipped', () => {
  const out = buildSessionContext(input({ state: { focus: 'x'.repeat(2000), next: '' } }));
  assert.ok(Buffer.byteLength(out) <= 1500);
  assert.match(out, /Focus: x+…/);
});

test('buildSessionContext: empty KB and no plan', () => {
  const out = buildSessionContext(input({ domains: {}, plan: null, healthMd: '', state: { focus: '', next: '' } }));
  assert.match(out, /Notes: 0/);
  assert.match(out, /Plan: none yet/);
  assert.match(out, /Attention: nothing flagged/);
  assert.match(out, /Focus: \(not set — STATE\.md\)/);
});
