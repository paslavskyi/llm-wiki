// Coverage rules: what a live note of a given kind is expected to be connected
// to. Data, not code paths — add a rule here and it shows up in
// index/coverage.md and the health summary. Deprecated notes count on neither
// side. A rule's `needs` is satisfied by ANY of:
//   types:     a neighbour of one of these types (any reference, either direction)
//   relations: one of these relation names on the note (forward or derived inverse)
//   check:     a predicate over the note's own frontmatter
import { relationEdges } from './relations.mjs';

const hasAcceptance = fm => Array.isArray(fm.acceptance) && fm.acceptance.length > 0;

export const COVERAGE_RULES = [
  {
    key: 'must-requirement-delivery',
    label: 'Must-have requirements with no story, feature or milestone',
    applies: fm => ['requirement', 'nfr'].includes(fm.type) && fm.priority === 'must',
    needs: { types: ['story', 'feature', 'milestone'] },
  },
  {
    key: 'must-requirement-acceptance',
    label: 'Must-have requirements without acceptance criteria',
    applies: fm => ['requirement', 'nfr'].includes(fm.type) && fm.priority === 'must',
    needs: { check: hasAcceptance },
  },
  {
    key: 'story-acceptance',
    label: 'Stories without acceptance criteria',
    applies: fm => fm.type === 'story',
    needs: { check: hasAcceptance },
  },
  {
    key: 'feature-purpose',
    label: 'Features that address no pain/JTBD and serve no persona/segment',
    applies: fm => fm.type === 'feature',
    needs: { relations: ['addresses', 'serves'] },
  },
  {
    key: 'persona-needs',
    label: 'Personas with no JTBD or pain',
    applies: fm => fm.type === 'persona',
    needs: { types: ['jtbd', 'pain'] },
  },
  {
    key: 'pain-addressed',
    label: 'Pains nothing addresses',
    applies: fm => fm.type === 'pain',
    needs: { relations: ['addressed_by'] },
  },
  {
    key: 'risk-mitigation',
    label: 'Open risks nothing mitigates (accepted risks are exempt)',
    applies: fm => fm.type === 'risk' && fm.status !== 'accepted',
    needs: { relations: ['mitigated_by'] },
  },
  {
    key: 'kpi-target',
    label: 'KPIs that measure nothing',
    applies: fm => fm.type === 'kpi',
    needs: { relations: ['measures'] },
  },
  {
    key: 'goal-scope',
    label: 'Goals with an empty scope',
    applies: fm => fm.type === 'goal',
    needs: { check: fm => Array.isArray(fm.scope) && fm.scope.length > 0 },
  },
];

// computeCoverage(notes) → [{ key, label, applicable, covered, gaps: [ids] }]
// notes: [{ frontmatter, links }] (as produced by readNote).
export function computeCoverage(notes) {
  const live = notes.filter(n => n.frontmatter.id && n.frontmatter.status !== 'deprecated');
  const typeById = new Map(live.map(n => [n.frontmatter.id, n.frontmatter.type]));
  const neighbours = new Map(live.map(n => [n.frontmatter.id, new Set()]));
  for (const n of live) {
    for (const t of n.links ?? []) {
      if (!typeById.has(t)) continue;
      neighbours.get(n.frontmatter.id).add(t);
      neighbours.get(t).add(n.frontmatter.id);
    }
  }
  const edges = relationEdges(live);

  const satisfied = (fm, needs) => {
    if (needs.types && [...neighbours.get(fm.id)].some(id => needs.types.includes(typeById.get(id)))) return true;
    if (needs.relations && needs.relations.some(r => (edges[fm.id]?.[r] ?? []).some(id => typeById.has(id)))) return true;
    if (needs.check && needs.check(fm)) return true;
    return false;
  };

  return COVERAGE_RULES.map(rule => {
    const subjects = live.filter(n => rule.applies(n.frontmatter)).map(n => n.frontmatter);
    const gaps = subjects.filter(fm => !satisfied(fm, rule.needs)).map(fm => fm.id).sort();
    return { key: rule.key, label: rule.label, applicable: subjects.length, covered: subjects.length - gaps.length, gaps };
  });
}
