import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkMarkdown } from '../lib/walk.mjs';
import { readNote } from '../lib/note.mjs';
import { loadValidators } from '../lib/schemas.mjs';

export async function validateNotes(rootDir) {
  const errors = [];
  const { validatorFor } = await loadValidators();
  const files = await walkMarkdown(join(rootDir, 'knowledge'));

  const notes = [];
  for (const file of files) {
    let note;
    try {
      note = await readNote(file);
    } catch (e) {
      errors.push(`${basename(file)}: invalid frontmatter — ${e.message.split('\n')[0]}`);
      continue;
    }
    notes.push(note);
  }

  // 1. schema + filename checks; collect ids
  const ids = new Map(); // id -> count
  for (const note of notes) {
    const fm = note.frontmatter;
    const id = fm.id;
    if (!id) {
      errors.push(`${note.fileName}: missing frontmatter "id"`);
      continue;
    }
    ids.set(id, (ids.get(id) ?? 0) + 1);

    const validate = validatorFor(fm.type);
    if (!validate(fm)) {
      const detail = (validate.errors ?? [])
        .map(e => `${e.instancePath || '/'} ${e.message}`)
        .join('; ');
      errors.push(`${id}: schema error — ${detail}`);
    }

    if (!note.fileName.startsWith(`${id}-`) && note.fileName !== `${id}.md`) {
      errors.push(`${id}: filename "${note.fileName}" must start with the id`);
    }
  }

  // 2. duplicate ids
  for (const [id, count] of ids) {
    if (count > 1) errors.push(`duplicate id ${id} (${count} files)`);
  }

  // 3. dangling links
  for (const note of notes) {
    for (const target of note.links) {
      if (!ids.has(target)) {
        errors.push(`${note.frontmatter.id ?? note.fileName}: dangling link → ${target}`);
      }
    }
  }

  // 4. parent/topic must resolve to an existing topic note
  const topicIds = new Set(
    notes.filter(n => n.frontmatter.type === 'topic' && n.frontmatter.id)
         .map(n => n.frontmatter.id)
  );
  for (const note of notes) {
    const fm = note.frontmatter;
    const who = fm.id ?? note.fileName;
    const parent = fm.parent;
    if (typeof parent === 'string' && parent) {
      if (!ids.has(parent)) {
        errors.push(`${who}: parent → ${parent} does not exist`);
      } else if (!topicIds.has(parent)) {
        errors.push(`${who}: parent → ${parent} must point to a topic note`);
      }
    }
    const topic = fm.topic;
    if (typeof topic === 'string' && topic) {
      if (!ids.has(topic)) {
        errors.push(`${who}: topic → ${topic} does not exist`);
      } else if (!topicIds.has(topic)) {
        errors.push(`${who}: topic → ${topic} must point to a topic note`);
      }
    }
  }

  return { errors };
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? process.cwd();
  const { errors } = await validateNotes(root);
  if (errors.length) {
    console.error(`✗ ${errors.length} validation error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('✓ knowledge base valid');
}
