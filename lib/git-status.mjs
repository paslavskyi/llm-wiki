// Parse `git status --porcelain` output → array of knowledge/** paths that
// differ from HEAD (untracked ??, modified M, added A, deleted D, renamed R).
// Pure: string in, array out.

export function parseKnowledgeChanges(porcelain) {
  const out = [];
  for (const rawLine of String(porcelain ?? '').split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim()) continue;
    // porcelain v1: XY<space>path  (path may be "old -> new" for renames)
    const rest = line.slice(3);
    let path = rest;
    const arrow = rest.indexOf(' -> ');
    if (arrow !== -1) path = rest.slice(arrow + 4); // take the new path
    path = path.replace(/^"|"$/g, ''); // strip quoting if present
    const norm = path.replaceAll('\\', '/');
    if (norm.startsWith('knowledge/') && norm.endsWith('.md')) {
      out.push(norm);
    }
  }
  return out;
}
