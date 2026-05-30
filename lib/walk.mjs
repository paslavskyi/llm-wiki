import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function walkMarkdown(dir) {
  const out = [];
  async function recurse(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) await recurse(full);
      else if (e.isFile() && e.name.endsWith('.md')) out.push(full);
    }
  }
  await recurse(dir);
  return out.sort();
}
