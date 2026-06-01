import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// git quotes paths with non-ASCII/special chars when core.quotePath is on
// (the default): wraps in "..." with C-style octal escapes (\321\201 …).
// We run git with -c core.quotePath=false (raw UTF-8), but this stays as a
// belt-and-suspenders unquote so the parser is correct regardless of caller.
function unquoteGitPath(field) {
  const s = field.trim();
  if (s.length < 2 || s[0] !== '"' || s[s.length - 1] !== '"') return s;
  const inner = s.slice(1, -1);
  // decode \ooo octal byte escapes (UTF-8) and common \-escapes
  const bytes = [];
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && i + 3 < inner.length + 1 && /[0-7]/.test(inner[i + 1] ?? '')) {
      const oct = inner.slice(i + 1, i + 4);
      if (/^[0-7]{3}$/.test(oct)) { bytes.push(parseInt(oct, 8)); i += 3; continue; }
    }
    if (inner[i] === '\\' && (inner[i + 1] === '"' || inner[i + 1] === '\\')) {
      bytes.push(inner.charCodeAt(i + 1)); i += 1; continue;
    }
    bytes.push(inner.charCodeAt(i));
  }
  try { return new TextDecoder('utf-8').decode(Uint8Array.from(bytes)); }
  catch { return inner; }
}

// classifyDelta: parse `git diff --name-status` lines → knowledge/ buckets.
// Optional area = a knowledge subfolder name (e.g. "users").
export function classifyDelta(nameStatus, { area } = {}) {
  const added = [], updated = [], deleted = [];
  const prefix = area ? `knowledge/${area}/` : 'knowledge/';
  for (const rawLine of String(nameStatus ?? '').split('\n')) {
    const line = rawLine.replace(/\r$/, '').trim();
    if (!line) continue;
    const code = line[0];
    // rename/copy: name-status uses Rxx\told\tnew (or Cxx\told\tnew); take the last field
    const parts = line.split('\t');
    if (parts.length < 2) continue; // non-name-status line (e.g. log subject) — skip, keep parsing
    // Defense in depth: even if git quoted the path (core.quotePath), strip the
    // wrapping quotes so non-ASCII (e.g. Cyrillic) note names are still matched.
    const norm = unquoteGitPath(parts[parts.length - 1]).replaceAll('\\', '/');
    if (!norm.startsWith(prefix) || !norm.endsWith('.md')) continue;
    if (code === 'A' || code === 'R' || code === 'C') added.push(norm);
    else if (code === 'M') updated.push(norm);
    else if (code === 'D') deleted.push(norm);
  }
  added.sort(); updated.sort(); deleted.sort();
  return { added, updated, deleted };
}

// CLI: node tools/session-delta.mjs [--since "<date>"] [--ref <gitref>] [--area <name>]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const getArg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const since = getArg('--since');
  const ref = getArg('--ref');
  const area = getArg('--area');
  const root = process.cwd();

  let range;
  if (ref) range = `${ref}..HEAD`;
  else if (since) range = `--since=${JSON.stringify(since)}`;
  else range = 'HEAD~1..HEAD';

  // For --since we need log form; for ref range a diff form. Use diff for ref, log for since.
  let nameStatus = '';
  try {
    // -c core.quotePath=false → git prints raw UTF-8 paths (no "..."/octal),
    // so non-ASCII (Cyrillic) note names are matched correctly.
    if (since) {
      nameStatus = execSync(`git -c core.quotePath=false log --since=${JSON.stringify(since)} --name-status --pretty=format: -- knowledge/`, { cwd: root, encoding: 'utf8' });
    } else {
      nameStatus = execSync(`git -c core.quotePath=false diff --name-status ${range} -- knowledge/`, { cwd: root, encoding: 'utf8' });
    }
  } catch { nameStatus = ''; }

  const delta = classifyDelta(nameStatus, { area });
  console.log(JSON.stringify(delta, null, 2));
}
