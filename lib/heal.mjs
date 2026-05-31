// healNote: reconstruct a note to a healthy state (rule_set A–E). Pure.

const REQUIRED_BASE = ['id', 'type', 'title', 'status', 'summary'];
const REQUIRED_BY_TYPE = {
  requirement: ['priority', 'category'],
  nfr: ['priority', 'category'],
  topic: ['parent'],
};
const KEY_ORDER = ['id', 'type', 'title', 'status', 'summary', 'priority', 'category',
  'parent', 'topic', 'tags', 'links', 'created', 'updated', 'superseded_by'];

export function slugify(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Follow superseded_by chain to the live head; guard against cycles.
export function resolveSupersede(id, supersededIndex) {
  const seen = new Set();
  let cur = id;
  while (supersededIndex.has(cur)) {
    if (seen.has(cur)) return id; // cycle → give up, return original
    seen.add(cur);
    cur = supersededIndex.get(cur);
  }
  return cur;
}

function orderKeys(fm) {
  const out = {};
  for (const k of KEY_ORDER) if (k in fm) out[k] = fm[k];
  for (const k of Object.keys(fm)) if (!(k in out)) out[k] = fm[k]; // unknown keys preserved, after known
  return out;
}

export function healNote(note, ctx) {
  const { existing, supersededIndex = new Map(), today } = ctx;
  const fm = structuredClone(note.frontmatter);
  const body = note.body ?? '';

  // B3: required fields
  const required = [...REQUIRED_BASE, ...(REQUIRED_BY_TYPE[fm.type] ?? [])];
  for (const k of required) {
    // `parent` is required to be PRESENT, but null is a valid value
    // (a top-level topic has parent: null). All other fields must be non-empty.
    const missing = fm[k] === undefined || fm[k] === '' || (fm[k] === null && k !== 'parent');
    if (missing) {
      throw new Error(`heal: missing required field "${k}" for type ${fm.type}`);
    }
  }

  // A1: id preserved from existing if present
  if (existing?.frontmatter?.id) fm.id = existing.frontmatter.id;

  // B5: status default
  if (!fm.status) fm.status = 'draft';

  // B4: created once, updated every write
  fm.created = existing?.frontmatter?.created ?? fm.created ?? today;
  fm.updated = today;

  // C7: heal link/parent/topic references to live head
  const healRef = (v) => (typeof v === 'string' ? resolveSupersede(v, supersededIndex) : v);
  if (Array.isArray(fm.links)) {
    const healed = fm.links.map(healRef)
      .filter(t => t !== fm.id);          // C9 self-ref removed
    fm.links = [...new Set(healed)];      // C8 dedupe, preserve order
  }
  if (typeof fm.parent === 'string') fm.parent = healRef(fm.parent);
  if (typeof fm.topic === 'string') fm.topic = healRef(fm.topic);

  // B6 + D: deterministic key order, unknown fields preserved
  return { frontmatter: orderKeys(fm), body };
}
