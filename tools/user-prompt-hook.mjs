import { execSync } from 'node:child_process';
import { writeFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { parseKnowledgeChanges } from '../lib/git-status.mjs';
import { nextMarkerState, shouldRemind, readMarker } from '../lib/dirty-marker.mjs';
import { decide } from './should-commit.mjs';
import { autoCommit } from './auto-commit.mjs';
import { loadConfig } from '../lib/config.mjs';

const root = process.cwd();

// The validate gate only works if the git hook is actually installed — git
// hooks don't survive cloning, so nudge here (mechanism, not instruction).
try {
  await access(join(root, 'tools', 'hooks', 'pre-commit'));
  try {
    await access(join(root, '.git', 'hooks', 'pre-commit'));
  } catch {
    console.log('[kb] git pre-commit guard is NOT installed — run `npm run install-hooks` (validate gate is inactive until then).');
  }
} catch { /* no hook source in this repo */ }

const config = (await loadConfig(root)).persistence;
if (config.autocommit === 'off') process.exit(0);

const now = Date.now();
let porcelain;
try {
  porcelain = execSync('git status --porcelain -uall', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch {
  // git failed (transient lock, not a repo, etc.): degrade to no changes, never disrupt.
  porcelain = '';
}
const changes = parseKnowledgeChanges(porcelain);
const dirty = changes.length > 0;

const oldestPath = join(root, '.git', 'kb-oldest-dirty');
const remindPath = join(root, '.git', 'kb-last-remind');
const existing = await readMarker(oldestPath);
const nextOldest = nextMarkerState({ dirty, existing, now });
if (nextOldest == null) await rm(oldestPath, { force: true });
else if (existing == null) await writeFile(oldestPath, String(nextOldest), 'utf8');

const decision = decide({ changes, oldestDirtyMs: nextOldest, lastRemindMs: await readMarker(remindPath), now, config });

if (decision.level === 'hard') {
  autoCommit(root, `kb: auto-save ${decision.count} changed notes (safety-net)`);
  process.exit(0);
}
if (decision.level === 'commit') {
  console.log(`[kb] ${decision.count} uncommitted knowledge changes (oldest ${decision.oldestAgeHours.toFixed(1)}h). Before replying, regenerate indexes and commit knowledge/ + index/ with a concise, meaningful message describing what changed.`);
  process.exit(0);
}
if (decision.level === 'remind') {
  if (shouldRemind({ lastRemind: await readMarker(remindPath), now, everyHours: config.remind_every_hours })) {
    await writeFile(remindPath, String(now), 'utf8');
    console.log(`[kb] Reminder: ${decision.count} unsaved knowledge notes (oldest ${decision.oldestAgeHours.toFixed(1)}h). Suggest committing when convenient.`);
  }
  process.exit(0);
}
process.exit(0);
