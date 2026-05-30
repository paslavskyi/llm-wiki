import { copyFile, chmod, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = join(root, 'tools', 'hooks', 'pre-commit');
const destDir = join(root, '.git', 'hooks');
const dest = join(destDir, 'pre-commit');

await mkdir(destDir, { recursive: true });
await copyFile(src, dest);
try { await chmod(dest, 0o755); } catch { /* chmod is a no-op / may fail on Windows; fine */ }
console.log(`✓ installed pre-commit hook → ${dest}`);
