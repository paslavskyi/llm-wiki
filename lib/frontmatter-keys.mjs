// frontmatter-keys.mjs — raw-text scan for duplicate top-level frontmatter keys.
//
// gray-matter / js-yaml silently keep the LAST of a duplicated mapping key on
// parse, so a corrupt note with two `title:` lines parses "fine" and the
// corruption is invisible in the parsed object. To detect it we must scan the
// RAW `---`…`---` block line-by-line for repeated keys at indent 0.
//
// Used as defense in depth (Bug 2) by both the write pipeline (serialize-time
// assert: never write a corrupt file) and validate (flag any that slipped in).

// Extract the raw frontmatter block (text between the first two `---` fences).
// Returns null when there is no leading frontmatter block.
export function extractFrontmatterBlock(raw) {
  const text = String(raw ?? '');
  if (!/^---\r?\n/.test(text)) return null; // frontmatter must start the file
  const afterOpen = text.slice(text.indexOf('\n') + 1);
  const closeIdx = afterOpen.search(/^---\s*$/m);
  if (closeIdx === -1) return null;
  return afterOpen.slice(0, closeIdx);
}

// Return the list of top-level (indent-0) keys that appear more than once.
// Empty array when there are none (or no frontmatter block).
export function findDuplicateTopLevelKeys(raw) {
  const block = extractFrontmatterBlock(raw);
  if (block == null) return [];
  const counts = new Map();
  for (const line of block.split(/\r?\n/)) {
    if (line.length === 0) continue;
    if (/^\s/.test(line)) continue;     // indented => nested, not top-level
    if (line.startsWith('#')) continue; // comment
    if (line.startsWith('-')) continue; // sequence item
    const m = /^([^:\s][^:]*):(?:\s|$)/.exec(line);
    if (!m) continue;
    const key = m[1].trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dups = [];
  for (const [key, n] of counts) if (n > 1) dups.push(key);
  return dups;
}

// Throw if the serialized note text has any duplicate top-level frontmatter key.
// Called at serialize-time so a corrupt file is never written/renamed into place.
export function assertNoDuplicateFrontmatterKeys(text) {
  const dups = findDuplicateTopLevelKeys(text);
  if (dups.length > 0) {
    throw new Error(`write-note: duplicate frontmatter key(s): ${dups.join(', ')}`);
  }
}
