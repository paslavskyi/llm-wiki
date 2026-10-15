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

// checkDecision: errors (strings, without the id) for an accepted decision.
export function checkDecision(fm, body) {
  if (fm.type !== 'decision' || fm.status !== 'accepted') return [];
  const have = decisionSections(body);
  const missing = REQUIRED_SECTIONS.filter(s => !have.includes(s));
  return missing.length ? [`accepted decision is missing section(s): ${missing.map(s => LABEL[s]).join(', ')}`] : [];
}
