import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// classifyDelta: parse `git diff --name-status` lines → knowledge/ buckets.
// Optional area = a knowledge subfolder name (e.g. "users").
export function classifyDelta(nameStatus, { area } = {}) {
  const added = [], updated = [], deleted = [];
  const prefix = area ? `knowledge/${area}/` : 'knowledge/';
  for (const rawLine of String(nameStatus ?? '').split('\n')) {
    const line = rawLine.replace(/\r$/, '').trim();
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab === -1) continue; // non-name-status line (e.g. log subject) — skip, keep parsing
    const code = line[0];
    // rename/copy: name-status uses Rxx\told\tnew (or Cxx\told\tnew); take the last field
    const parts = line.split('\t');
    const path = parts[parts.length - 1];
    const norm = path.replaceAll('\\', '/');
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
    if (since) {
      nameStatus = execSync(`git log --since=${JSON.stringify(since)} --name-status --pretty=format: -- knowledge/`, { cwd: root, encoding: 'utf8' });
    } else {
      nameStatus = execSync(`git diff --name-status ${range} -- knowledge/`, { cwd: root, encoding: 'utf8' });
    }
  } catch { nameStatus = ''; }

  const delta = classifyDelta(nameStatus, { area });
  console.log(JSON.stringify(delta, null, 2));
}
