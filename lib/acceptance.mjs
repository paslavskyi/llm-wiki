// Acceptance criteria on requirement / nfr / story notes:
//   acceptance:
//     - id: FR-012.1                       # assigned by the write pipeline
//       text: WHEN … THE SYSTEM SHALL …    # EARS, or Given … When … Then …
//       verify: how we check it (optional)
// A criterion is citable on its own as FR-012.1 (in links, relations or
// [[FR-012.1]] in a body). Form and vagueness are health signals, not errors —
// criteria may be written in English or Ukrainian.

export const ACCEPTANCE_TYPES = new Set(['requirement', 'nfr', 'story']);

const L = '\\p{L}';
const word = (alts) => new RegExp(`(?<![${L}])(?:${alts})(?![${L}])`, 'iu');
const GIVEN = word('given|дано');
const THEN = word('then|тоді');
const SHALL = word('shall|must|повинн\\p{L}*|повинен|мусить|має');

// criterionForm(text) → 'gwt' | 'ears' | null
export function criterionForm(text) {
  const t = String(text ?? '');
  if (GIVEN.test(t) && THEN.test(t)) return 'gwt';
  if (SHALL.test(t)) return 'ears';
  return null;
}

const VAGUE = new RegExp(
  `(?<![${L}])(?:fast|quick(?:ly)?|easy|easily|simple|intuitive|user-friendly|secure|scalable|robust|reliable`
  + `|efficient|flexible|seamless(?:ly)?|responsive|modern`
  + `|швидк|легк|прост|зручн|інтуїтивн|безпечн|надійн|масштабован|ефективн|гнучк|сучасн)`,
  'iu',
);

// isVague: a quality word with no number to make it measurable.
export function isVague(text) {
  const t = String(text ?? '');
  return VAGUE.test(t) && !/\d/.test(t);
}

// healAcceptance: strings → { id, text }; missing ids numbered after the
// highest existing one, so ids already cited never shift.
export function healAcceptance(noteId, list) {
  if (!Array.isArray(list)) return list;
  const re = new RegExp(`^${noteId}\\.(\\d+)$`);
  let max = 0;
  for (const item of list) {
    const m = String(item?.id ?? '').match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return list.map(item => {
    const obj = typeof item === 'string' ? { text: item } : item;
    if (!obj || typeof obj !== 'object' || obj.id) return obj;
    return { id: `${noteId}.${++max}`, ...obj };
  });
}

// checkAcceptance: errors (strings, without the id) for a note's criteria.
export function checkAcceptance(fm) {
  if (fm.acceptance === undefined) return [];
  if (!ACCEPTANCE_TYPES.has(fm.type)) return ['acceptance is only for requirement/nfr/story notes'];
  if (!Array.isArray(fm.acceptance)) return ['acceptance must be a list of criteria'];
  const errors = [];
  const seen = new Set();
  const re = new RegExp(`^${fm.id}\\.\\d+$`);
  for (const c of fm.acceptance) {
    const id = String(c?.id ?? '');
    if (!re.test(id)) { errors.push(`criterion id "${id}" must look like ${fm.id}.<n>`); continue; }
    if (seen.has(id)) errors.push(`duplicate criterion id ${id}`);
    seen.add(id);
    if (typeof c.text !== 'string' || !c.text.trim()) errors.push(`criterion ${id} needs text`);
  }
  return errors;
}
