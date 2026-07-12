// Shared KB loader: read every note under knowledge/, skipping files whose
// frontmatter fails to parse (validate reports those). Replaces the identical
// loop that had grown in graph/impact/plan/server independently.
import { join } from 'node:path';
import { walkMarkdown } from './walk.mjs';
import { readNote } from './note.mjs';

export async function loadNotes(rootDir) {
  const files = await walkMarkdown(join(rootDir, 'knowledge'));
  const notes = [];
  for (const fp of files) {
    try { notes.push(await readNote(fp)); } catch { /* validate reports */ }
  }
  return notes;
}
