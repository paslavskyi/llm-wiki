import { execSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Technical commit used ONLY for the hard safety-net. Commits knowledge/ + index/
// with a factual message. Regenerates indexes + health first.
export function autoCommit(root, message) {
  execSync('node tools/reindex.mjs', { cwd: root, stdio: 'ignore' });
  try { execSync('node tools/graph.mjs', { cwd: root, stdio: 'ignore' }); } catch { /* non-blocking */ }
  execSync('git add knowledge/ index/', { cwd: root });
  execSync(`git commit --no-verify -m ${JSON.stringify(message)}`, { cwd: root });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const msg = process.argv[2] ?? 'kb: auto-save (safety-net)';
  autoCommit(root, msg);
  await rm(join(root, '.git', 'kb-oldest-dirty'), { force: true });
  console.log('✓ safety-net commit done');
}
