// Decision notes follow MADR: frontmatter decided / deciders / consulted /
// informed / revisit, and a body of `## …` sections. Headings may be English or
// Ukrainian. An accepted decision must state its context, the decision and its
// consequences; considered options and confirmation (how we'll know it still
// holds) are recommended and surfaced by health.

const SECTIONS = [
  ['context', /^(context|context and problem statement|контекст)$/i],
  ['options', /^(considered options|options|розглянуті варіанти|варіанти)$/i],
  ['decision', /^(decision|decision outcome|рішення)$/i],
  ['consequences', /^(consequences|наслідки)$/i],
  ['confirmation', /^(confirmation|підтвердження|перевірка)$/i],
];
const LABEL = { context: 'Context', options: 'Considered Options', decision: 'Decision',
  consequences: 'Consequences', confirmation: 'Confirmation' };

export const REQUIRED_SECTIONS = ['context', 'decision', 'consequences'];
export const RECOMMENDED_SECTIONS = ['options', 'confirmation'];

// decisionSections(body) → section keys present, in body order.
export function decisionSections(body) {
  const found = [];
  for (const m of String(body ?? '').matchAll(/^##\s+(.+?)\s*$/gm)) {
    const hit = SECTIONS.find(([, re]) => re.test(m[1]));
    if (hit && !found.includes(hit[0])) found.push(hit[0]);
  }
  return found;
}

export function missingRequiredSections(body) {
  const have = decisionSections(body);
  return REQUIRED_SECTIONS.filter(s => !have.includes(s));
}

// isGrandfathered: a KB that adopted MADR after it already had a decision log
// sets `decisions.madr_required_since` (YYYY-MM-DD); decisions created earlier
// are exempt from the gate and reported by health instead.
export function isGrandfathered(fm, requiredSince) {
  return Boolean(requiredSince && fm.created && String(fm.created) < requiredSince);
}

// checkDecision: errors (strings, without the id) for an accepted decision.
export function checkDecision(fm, body, { requiredSince } = {}) {
  if (fm.type !== 'decision' || fm.status !== 'accepted') return [];
  if (isGrandfathered(fm, requiredSince)) return [];
  const missing = missingRequiredSections(body);
  return missing.length ? [`accepted decision is missing section(s): ${missing.map(s => LABEL[s]).join(', ')}`] : [];
}
