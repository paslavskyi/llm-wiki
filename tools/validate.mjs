import { basename, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { walkMarkdown } from '../lib/walk.mjs';
import { readNote } from '../lib/note.mjs';
import { loadValidators } from '../lib/schemas.mjs';
import { findDuplicateTopLevelKeys } from '../lib/frontmatter-keys.mjs';
import { checkVocabulary } from '../lib/vocabulary.mjs';
import { checkMarkers } from '../lib/markers.mjs';
import { checkRelations } from '../lib/relations.mjs';
import { checkAcceptance } from '../lib/acceptance.mjs';
import { checkDecision } from '../lib/decision.mjs';
import { checkValidation } from '../lib/assumption.mjs';
import { domainOf } from '../lib/domain.mjs';

// STATE.md is intent-only (see CLAUDE.md → "STATE.md scope"): it must never hold
// derived facts that already live — fresh — in index/MAP.md + index/health.md. A
// hand-kept copy of derived state has no invalidation and silently drifts (this
// is the root cause of STATE.md going stale). This gate forbids the drift-prone
// content from re-entering STATE.md, turning the design rule into an enforced
// invariant. It does NOT (cannot) check whether the intent itself is fresh.
const STATE_FORBIDDEN = [
  [/progress by domain/i, 'a "Progress by domain" section'],
  [/\btotal\s+notes?\b/i, 'a "total notes" count'],
  [/\b\d+\s+(?:notes?|нот\w*)\b/i, 'a note count (e.g. "133 notes")'],
  [/\bTOP-\d+\b/, 'a specific topic-node id (reference the area by name instead)'],
  [/\b(?:Q|RISK|ASMP)-\d+\b/, 'a specific open-item id (Q-/RISK-/ASMP-)'],
];

// checkStateScope: lint STATE.md for derived content that belongs to the indexes.
export async function checkStateScope(rootDir) {
  let text;
  try {
    text = await readFile(join(rootDir, 'STATE.md'), 'utf8');
  } catch {
    return []; // no STATE.md → nothing to check
  }
  const errors = [];
  for (const [re, what] of STATE_FORBIDDEN) {
    const m = text.match(re);
    if (m) {
      errors.push(
        `STATE.md: must not contain ${what} — found ${JSON.stringify(m[0].trim().slice(0, 50))}. ` +
        `That is derived state (it lives in index/MAP.md + index/health.md); ` +
        `STATE.md holds intent only (CLAUDE.md → "STATE.md scope").`,
      );
    }
  }
  return errors;
}

export async function validateNotes(rootDir) {
  const errors = [];
  const { validatorFor } = await loadValidators();
  const files = await walkMarkdown(join(rootDir, 'knowledge'));

  const notes = [];
  for (const file of files) {
    // Defense in depth (Bug 2): gray-matter/js-yaml silently keep the LAST of a
    // duplicated frontmatter key on parse, so scan the RAW block for repeated
    // top-level keys (parsing would collapse them and hide the corruption).
    try {
      const raw = await readFile(file, 'utf8');
      const dupKeys = findDuplicateTopLevelKeys(raw);
      if (dupKeys.length > 0) {
        errors.push(`${basename(file)}: duplicate frontmatter key — ${dupKeys.join(', ')}`);
      }
    } catch {
      // unreadable file is surfaced by readNote below
    }

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

    for (const e of checkVocabulary(fm, domainOf(note.filePath))) errors.push(`${id}: ${e}`);
    for (const e of checkMarkers(fm, note.body)) errors.push(`${id}: ${e}`);
    for (const e of checkAcceptance(fm)) errors.push(`${id}: ${e}`);
    for (const e of checkDecision(fm, note.body)) errors.push(`${id}: ${e}`);
    for (const e of checkValidation(fm)) errors.push(`${id}: ${e}`);

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

  // 3b. criterion references (FR-012.1) must name an existing criterion
  const criteria = new Set(notes.flatMap(n => (Array.isArray(n.frontmatter.acceptance) ? n.frontmatter.acceptance : [])
    .map(c => c?.id).filter(Boolean)));
  for (const note of notes) {
    for (const ref of note.criterionRefs ?? []) {
      if (!criteria.has(ref)) errors.push(`${note.frontmatter.id ?? note.fileName}: criterion ${ref} does not exist`);
    }
  }

  // 4. parent/topic must resolve to an existing topic note
  const typeById = new Map(notes.map(n => [n.frontmatter.id, n.frontmatter.type]));
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
    for (const e of checkRelations(fm, typeById)) errors.push(`${who}: ${e}`);
    for (const s of Array.isArray(fm.sources) ? fm.sources : []) {
      if (ids.has(s) && typeById.get(s) !== 'source') {
        errors.push(`${who}: sources → ${s} must point to a source note`);
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

  // 5. plan invariants: singleton live plan; active/queue/backlog
  // disjoint (an id in two lists would mean two contradictory delivery states).
  const livePlans = notes.filter(
    n => n.frontmatter.type === 'plan' && n.frontmatter.status !== 'deprecated',
  );
  if (livePlans.length > 1) {
    errors.push(`plan: expected a single live plan note, found ${livePlans.length} `
      + `(${livePlans.map(n => n.frontmatter.id).join(', ')})`);
  }
  for (const plan of livePlans) {
    const fm = plan.frontmatter;
    const seen = new Map(); // id -> list name
    for (const list of ['active', 'queue', 'backlog']) {
      for (const id of fm[list] ?? []) {
        if (seen.has(id)) {
          errors.push(`${fm.id}: ${id} is in both "${seen.get(id)}" and "${list}" — plan lists must be disjoint`);
        } else {
          seen.set(id, list);
        }
      }
    }
    // plan items must reference live notes (a deprecated item hides real state)
    const statusById = new Map(notes.map(n => [n.frontmatter.id, n.frontmatter.status]));
    for (const [id, list] of seen) {
      if (statusById.get(id) === 'deprecated') {
        errors.push(`${fm.id}: ${list} item ${id} is deprecated — replace with its superseding note`);
      }
    }
  }

  // 6. timeline invariants: singleton live timeline; sequence items
  // must be live milestone notes (order semantics belong to milestones only).
  const liveTimelines = notes.filter(
    n => n.frontmatter.type === 'timeline' && n.frontmatter.status !== 'deprecated',
  );
  if (liveTimelines.length > 1) {
    errors.push(`timeline: expected a single live timeline note, found ${liveTimelines.length} `
      + `(${liveTimelines.map(n => n.frontmatter.id).join(', ')})`);
  }
  const noteByIdTL = new Map(notes.map(n => [n.frontmatter.id, n.frontmatter]));
  for (const tl of liveTimelines) {
    for (const id of tl.frontmatter.sequence ?? []) {
      const t = noteByIdTL.get(id);
      if (!t) continue; // dangling covered by the links gate
      if (t.type !== 'milestone') {
        errors.push(`${tl.frontmatter.id}: sequence item ${id} is a ${t.type} — timeline holds milestones only`);
      } else if (t.status === 'deprecated') {
        errors.push(`${tl.frontmatter.id}: sequence item ${id} is deprecated — replace with its superseding note`);
      }
    }
  }

  // 7. STATE.md scope gate — prevent derived-state drift re-entering STATE.md.
  errors.push(...(await checkStateScope(rootDir)));

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
