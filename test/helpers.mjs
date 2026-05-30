import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

export async function makeTmpDir() {
  return mkdtemp(join(tmpdir(), 'kbtest-'));
}

export async function writeFileDeep(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, 'utf8');
}

export async function cleanup(dir) {
  await rm(dir, { recursive: true, force: true });
}
