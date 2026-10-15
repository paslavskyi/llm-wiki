// The type & id vocabulary (CLAUDE.md → "Type & ID vocabulary") as data, so the
// validator and the write pipeline enforce it instead of trusting the LLM.
// domain: the top-level knowledge/<domain>/ folder a type lives in; null = any
// (topic nodes live in their own area's folder; cross-cutting notes sit next to
// whatever they concern).

const entries = [
  [['vision', 'principle', 'value-prop'], ['VIS'], 'vision'],
  [['competitor'], ['CMP'], 'market'],
  [['market-insight'], ['MKT'], 'market'],
  [['persona'], ['PER'], 'users'],
  [['segment'], ['SEG'], 'users'],
  [['jtbd'], ['JTBD'], 'users'],
  [['pain'], ['PAIN'], 'users'],
  [['feature'], ['FEAT'], 'product'],
  [['requirement'], ['FR', 'NFR'], 'product'],
  [['nfr'], ['NFR'], 'product'],
  [['story'], ['STORY'], 'product'],
  [['entity'], ['ENT'], 'product'],
  [['term'], ['TERM'], 'product'],
  [['topic'], ['TOP'], null],
  [['milestone'], ['MIL'], 'roadmap'],
  [['kpi'], ['KPI'], 'roadmap'],
  [['goal'], ['GOAL'], 'roadmap'],
  [['plan'], ['PLAN'], 'roadmap'],
  [['timeline'], ['TL'], 'roadmap'],
  [['positioning'], ['POS'], 'gtm'],
  [['channel'], ['CHAN'], 'gtm'],
  [['pricing'], ['PRICE'], 'gtm'],
  [['message'], ['MSG'], 'gtm'],
  [['risk'], ['RISK'], null],
  [['assumption'], ['ASMP'], null],
  [['question'], ['Q'], null],
  [['decision'], ['DEC'], 'decisions'],
  [['source'], ['SRC'], 'sources'],
];

export const VOCABULARY = Object.fromEntries(
  entries.flatMap(([types, prefixes, domain]) => types.map(t => [t, { prefixes, domain }])),
);

// Claims about the world (who users are, what the market does) that should be
// backed by a `source` note via `sources:` once accepted — health flags the gap.
export const EVIDENCE_TYPES = new Set(['persona', 'segment', 'jtbd', 'pain', 'competitor', 'market-insight']);

// checkVocabulary: errors (strings, without the id) for a note's type/prefix/domain.
export function checkVocabulary(fm, domain) {
  const entry = VOCABULARY[fm.type];
  if (!entry) return [`unknown type "${fm.type}" (see CLAUDE.md → Type & ID vocabulary)`];
  const errors = [];
  const prefix = String(fm.id).split('-')[0];
  if (!entry.prefixes.includes(prefix)) {
    const expected = entry.prefixes.map(p => `${p}-`).join(' or ');
    errors.push(`id prefix "${prefix}" does not match type "${fm.type}" (expected ${expected})`);
  }
  if (entry.domain && domain !== entry.domain) {
    errors.push(`type "${fm.type}" belongs in knowledge/${entry.domain}/, found in knowledge/${domain}/`);
  }
  return errors;
}
