// clarifyQueue: the next questions worth asking the owner, highest impact first
// (after Spec Kit /clarify: few questions, prioritised). Candidates are open
// question notes (Q-) and inline [NEEDS CLARIFICATION] / [ASSUMPTION] markers.
// Deterministic: score, then id, then position.
import { findMarkers } from './markers.mjs';
import { isOpenNote } from './open.mjs';

const PRIORITY_WEIGHT = { must: 3, should: 2, could: 1, wont: 0 };

export function clarifyQueue(notes, { limit = 5, topic } = {}) {
  const live = notes.filter(n => n.frontmatter.id && n.frontmatter.status !== 'deprecated');
  const inbound = new Map();
  for (const n of live) for (const t of n.links ?? []) inbound.set(t, (inbound.get(t) ?? 0) + 1);

  const items = [];
  for (const n of live) {
    const fm = n.frontmatter;
    if (topic && fm.topic !== topic) continue;
    if (fm.type === 'question' && isOpenNote(fm)) {
      items.push({ id: fm.id, kind: 'question', text: fm.title, score: 3 + (inbound.get(fm.id) ?? 0) });
    }
    const base = PRIORITY_WEIGHT[fm.priority] ?? 1;
    for (const m of findMarkers(n.body)) {
      const clarification = m.kind === 'NEEDS CLARIFICATION';
      items.push({
        id: fm.id,
        kind: clarification ? 'clarification' : 'assumption',
        text: m.text,
        score: base + (clarification ? 1 : 0) + (fm.status === 'proposed' ? 1 : 0),
      });
    }
  }
  return items
    .map((item, i) => ({ ...item, i }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id) || a.i - b.i)
    .slice(0, limit)
    .map(({ i, ...item }) => item);
}
