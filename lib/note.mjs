import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import matter from 'gray-matter';
import { relationTargets } from './relations.mjs';

// [[ID]] or [[ID.n]] — the latter cites acceptance criterion n of note ID.
const LINK_RE = /\[\[([A-Z]+-[A-Za-z0-9-]+(?:\.\d+)?)\]\]/g;
const CRITERION_RE = /^([A-Z]+-[A-Za-z0-9-]+)\.(\d+)$/;

// YAML parses unquoted ISO dates (e.g. `created: 2026-05-30`) into JS Date
// objects, but the schemas require string dates. Normalize any top-level Date
// values to `YYYY-MM-DD` strings so naturally-authored dates validate.
function normalizeDates(frontmatter) {
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value instanceof Date) {
      frontmatter[key] = value.toISOString().slice(0, 10);
    }
  }
  return frontmatter;
}

// Frontmatter fields that reference other notes by id. sources (evidence),
// scope (goal membership) and the plan lists are edges like `links`: including
// them here puts them under the dangling-link gate and into backlinks/impact
// automatically.
const REF_FIELDS = ['links', 'sources', 'scope', 'active', 'queue', 'backlog', 'sequence'];

function allRefs(frontmatter, body) {
  const refs = [];
  for (const field of REF_FIELDS) {
    if (Array.isArray(frontmatter[field])) {
      for (const l of frontmatter[field]) if (l) refs.push(String(l));
    }
  }
  refs.push(...relationTargets(frontmatter));
  for (const m of String(body ?? '').matchAll(LINK_RE)) refs.push(m[1]);
  return refs;
}

// Note ids referenced (a criterion reference counts as a link to its note).
export function extractLinks(frontmatter, body) {
  return [...new Set(allRefs(frontmatter, body).map(r => r.replace(CRITERION_RE, '$1')))];
}

// Acceptance-criterion ids referenced (e.g. FR-012.1).
export function extractCriterionRefs(frontmatter, body) {
  return [...new Set(allRefs(frontmatter, body).filter(r => CRITERION_RE.test(r)))];
}

export async function readNote(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const { data, content } = matter(raw);
  const frontmatter = normalizeDates(data);
  return {
    filePath,
    fileName: basename(filePath),
    frontmatter,
    body: content,
    links: extractLinks(data, content),
    criterionRefs: extractCriterionRefs(data, content),
  };
}
