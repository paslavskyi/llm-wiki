import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import matter from 'gray-matter';

const LINK_RE = /\[\[([A-Z]+-[A-Za-z0-9-]+)\]\]/g;

export function extractLinks(frontmatter, body) {
  const set = new Set();
  if (Array.isArray(frontmatter.links)) {
    for (const l of frontmatter.links) {
      if (l) set.add(String(l));
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
  return {
    filePath,
    fileName: basename(filePath),
    frontmatter: data,
    body: content,
    links: extractLinks(data, content),
  };
}
