// plan-history: reconstruct done/dropped events from the plan note's git
// history (it lives in git, never in the note). IO layer over
// the pure deriveDoneEvents in plan-core.mjs.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { deriveDoneEvents } from './plan-core.mjs';

const run = promisify(execFile);

async function git(rootDir, args) {
  // core.quotepath=false: the plan note's filename is Cyrillic; default git
  // output C-quotes non-ASCII paths ("knowledge/...\320..."), breaking matching.
  const { stdout } = await run('git', ['-c', 'core.quotepath=false', ...args],
    { cwd: rootDir, maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

// Commits touching the plan note, with the note's path at each commit
// (name-only per commit tolerates renames without --follow ambiguity).
async function planCommits(rootDir) {
  const out = await git(rootDir, [
    'log', '--format=%x01%H%x09%ad%x09%s', '--date=short', '--name-only',
    '--diff-filter=ACMR', '--', 'knowledge/*/PLAN-*.md', 'knowledge/PLAN-*.md',
  ]);
  const commits = [];
  for (const block of out.split('').filter(b => b.trim())) {
    const lines = block.split('\n').filter(l => l.trim());
    const [hash, date, ...subjectParts] = lines[0].split('\t');
    const path = lines.slice(1).find(l => /PLAN-.*\.md$/.test(l));
    if (path) commits.push({ hash, date, subject: subjectParts.join('\t'), path });
  }
  return commits.reverse(); // oldest → newest
}

async function listsAt(rootDir, hash, path) {
  const raw = await git(rootDir, ['show', `${hash}:${path}`]);
  const { data } = matter(raw);
  return {
    active: Array.isArray(data.active) ? data.active : [],
    queue: Array.isArray(data.queue) ? data.queue : [],
    backlog: Array.isArray(data.backlog) ? data.backlog : [],
  };
}

let cache = { head: null, result: null };

/**
 * loadPlanHistory(rootDir) -> { done, dropped, revisions: n }
 * Cached by HEAD: recomputed only after a new commit.
 */
export async function loadPlanHistory(rootDir) {
  let head = null;
  try { head = (await git(rootDir, ['rev-parse', 'HEAD'])).trim(); } catch { /* no git */ }
  if (head && cache.head === head) return cache.result;

  let revisions = [];
  try {
    const commits = await planCommits(rootDir);
    revisions = await Promise.all(commits.map(async c => ({
      hash: c.hash.slice(0, 7),
      date: c.date,
      subject: c.subject,
      lists: await listsAt(rootDir, c.hash, c.path),
    })));
  } catch { /* no git / no plan yet */ }

  const result = { ...deriveDoneEvents(revisions), revisions: revisions.length };
  cache = { head, result };
  return result;
}
