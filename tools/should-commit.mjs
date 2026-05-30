import { join } from 'node:path';
import { writeFile, rm } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseKnowledgeChanges } from '../lib/git-status.mjs';
import { ageHours, nextMarkerState, readMarker } from '../lib/dirty-marker.mjs';
import { loadConfig } from '../lib/config.mjs';

export function decide({ changes, oldestDirtyMs, lastRemindMs, now, config }) {
  const count = changes.length;
  const oldestAgeHours = count > 0 && oldestDirtyMs != null ? ageHours(oldestDirtyMs, now) : 0;
  const base = { count, oldestAgeHours };

  if (config.autocommit === 'off') return { ...base, level: 'none' };

  const crossed = count >= config.threshold || oldestAgeHours >= config.max_age_hours;
  if (!crossed) return { ...base, level: 'none' };

  if (config.hard_safety_net && count >= config.hard_threshold) {
    return { ...base, level: 'hard' };
  }
  if (config.autocommit === 'auto') return { ...base, level: 'commit' };
  return { ...base, level: 'remind' };
}

// --- CLI: run git, manage .git markers, print decision JSON ---
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const config = (await loadConfig(root)).persistence;
  const now = Date.now();

  let porcelain;
  try {
    porcelain = execSync('git status --porcelain -uall', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    // git failed (transient lock, not a repo, etc.): degrade to no changes.
    porcelain = '';
  }
  const changes = parseKnowledgeChanges(porcelain);
  const dirty = changes.length > 0;

  const oldestPath = join(root, '.git', 'kb-oldest-dirty');
  const existing = await readMarker(oldestPath);
  const nextOldest = nextMarkerState({ dirty, existing, now });
  if (nextOldest == null) { await rm(oldestPath, { force: true }); }
  else if (existing == null) { await writeFile(oldestPath, String(nextOldest), 'utf8'); }

  const lastRemindMs = await readMarker(join(root, '.git', 'kb-last-remind'));
  const decision = decide({ changes, oldestDirtyMs: nextOldest, lastRemindMs, now, config });
  console.log(JSON.stringify(decision));
}
