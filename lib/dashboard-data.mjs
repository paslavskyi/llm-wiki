// dashboard-data: PURE derivations behind the PM dashboard (DEC-031/032/033).
// The server (tools/dashboard/server.mjs) is only IO (fs, git, http); every
// computed product state lives here so it is unit-testable.
import { isOpenNote } from './open.mjs';

export function tally(items, key) {
  const out = {};
  for (const it of items) {
    const k = it[key] ?? 'unknown';
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

// STATE.md holds non-derivable intent; surface its sections verbatim.
export function parseState(md) {
  const sections = {};
  let name = null;
  for (const line of String(md ?? '').split(/\r?\n/)) {
    const h = line.match(/^## (.+)$/);
    if (h) { name = h[1].trim(); sections[name] = []; continue; }
    if (name) sections[name].push(line);
  }
  const text = k => (sections[k] ?? []).join('\n').trim();
  const byRe = re => {
    const key = Object.keys(sections).find(k => re.test(k));
    return key ? text(key) : '';
  };
  return { phase: text('Phase'), focus: text('Current focus'), liveTail: byRe(/live tail/i) };
}

export function monthlyTrend(notes) {
  const byMonth = new Map();
  const bump = (dateStr, key) => {
    if (!dateStr) return;
    const m = String(dateStr).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    const row = byMonth.get(m) ?? { month: m, created: 0, updated: 0 };
    row[key] += 1;
    byMonth.set(m, row);
  };
  for (const n of notes) {
    bump(n.created, 'created');
    bump(n.updated, 'updated');
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// Compact reference used everywhere an id is expanded for the client.
export function refOf(n) {
  return n
    ? { id: n.id, type: n.type, title: n.title, status: n.status, summary: n.summary, tags: n.tags }
    : null;
}

export function expandRef(byId, id) {
  return refOf(byId.get(id))
    ?? { id, type: null, title: '(невідома нотатка)', status: null, summary: '', tags: [] };
}

export function planMembership(plan) {
  const m = new Map();
  if (!plan) return m;
  for (const id of plan.active ?? []) m.set(id, 'active');
  for (const id of plan.queue ?? []) m.set(id, 'queue');
  for (const id of plan.backlog ?? []) m.set(id, 'backlog');
  return m;
}

// Completion is type-specific (status is KNOWLEDGE lifecycle, not delivery
// state): for milestone/risk/question/assumption `accepted` means closed;
// for feature/requirement/story it only means "agreed", so those count as
// done solely via the plan's git history (the item was worked and completed).
export const STATUS_IS_COMPLETION = new Set(['milestone', 'risk', 'question', 'assumption']);

export function isDoneItem(item, doneInPlan) {
  return doneInPlan.has(item.id)
    || (STATUS_IS_COMPLETION.has(item.type) && item.status === 'accepted');
}

export function computeGoals(goalNotes, { byId, membership, doneInPlan }) {
  return goalNotes.map(g => {
    const items = (g.scope ?? []).map(id => ({
      ...expandRef(byId, id),
      inPlan: membership.get(id) ?? (doneInPlan.has(id) ? 'done-plan' : null),
    }));
    for (const i of items) i.done = isDoneItem(i, doneInPlan);
    const done = items.filter(i => i.done).length;
    const counts = tally(items, 'inPlan');
    return {
      ...refOf(g),
      scope: items,
      progress: { done, total: items.length },
      planBreakdown: {
        active: counts.active ?? 0, queue: counts.queue ?? 0,
        backlog: counts.backlog ?? 0, done,
      },
    };
  }).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

// Product timeline (DEC-033): every state DERIVED — done = accepted (or plan
// history), в роботі = plan.active, прострочено = due passed, наступна = first
// not-done; «ми тут» sits before stages[nowIndex].
export function computeTimeline(tlNote, { byId, activeSet, doneInPlan, today }) {
  if (!tlNote) return null;
  const stages = (tlNote.sequence ?? []).map(id => {
    const m = byId.get(id);
    const done = m?.status === 'accepted' || doneInPlan.has(id);
    return {
      ...expandRef(byId, id),
      due: m?.due ?? null,
      done,
      inWork: activeSet.has(id),
      overdue: !done && !!m?.due && m.due < today,
    };
  });
  const firstNotDone = stages.findIndex(s => !s.done);
  stages.forEach((s, i) => {
    s.state = s.done ? 'done'
      : s.inWork ? (s.overdue ? 'inwork-overdue' : 'inwork')
      : s.overdue ? 'overdue'
      : i === firstNotDone ? 'next' : 'planned';
  });
  return {
    id: tlNote.id,
    stages,
    nowIndex: firstNotDone === -1 ? stages.length : firstNotDone,
  };
}

// Tech-debt slice: open risks carrying at least one of these tags (plus any
// audit-* tag). Extend as the tag taxonomy grows.
export const DEBT_TAGS = new Set(['security', 'data-loss', 'test-debt', 'reliability',
  'error-handling', 'debt', 'performance']);

export function computeTechdebt(liveNotes, debtTags = DEBT_TAGS) {
  const open = liveNotes.filter(isOpenNote);
  const isDebt = n => n.type === 'risk'
    && (n.tags.some(t => debtTags.has(t)) || n.tags.some(t => t.startsWith('audit-')));
  const risks = open.filter(isDebt);
  const byTag = {};
  for (const r of risks) {
    for (const t of r.tags) {
      if (t === 'risk' || t.startsWith('audit-')) continue;
      if (!debtTags.has(t)) continue;
      (byTag[t] ??= []).push(r.id);
    }
  }
  return { risks, byTag };
}
