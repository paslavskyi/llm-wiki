import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import matter from 'gray-matter';

const LINK_RE = /\[\[([A-Z]+-[A-Za-z0-9-]+)\]\]/g;

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

// Frontmatter fields that reference other notes by id. scope (goal membership)
// and the plan lists are edges like `links`: including them here puts
// them under the dangling-link gate and into backlinks/impact automatically.
const REF_FIELDS = ['links', 'scope', 'active', 'queue', 'backlog', 'sequence'];

export function extractLinks(frontmatter, body) {
  const set = new Set();
  for (const field of REF_FIELDS) {
    if (Array.isArray(frontmatter[field])) {
      for (const l of frontmatter[field]) {
        if (l) set.add(String(l));
      }
    }
  }
  for (const m of body.matchAll(LINK_RE)) {
    set.add(m[1]);
  }
  return [...set];
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
  };
}
