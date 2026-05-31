import { join, dirname, basename, resolve } from 'node:path';
import { writeFile, readFile, rename, unlink, mkdir, access } from 'node:fs/promises';
import matter from 'gray-matter';
import { walkMarkdown } from '../lib/walk.mjs';
import { readNote } from '../lib/note.mjs';
import { healNote, slugify } from '../lib/heal.mjs';
import { loadValidators } from '../lib/schemas.mjs';
import { assertNoDuplicateFrontmatterKeys } from '../lib/frontmatter-keys.mjs';

function todayISO(ctxToday) {
  // today must be injected (Date.now is unavailable in some contexts); fall back.
  return ctxToday ?? new Date().toISOString().slice(0, 10);
}

export async function buildSupersededIndex(rootDir) {
  const files = await walkMarkdown(join(rootDir, 'knowledge'));
  const idx = new Map();
  for (const fp of files) {
    let n;
    try { n = await readNote(fp); } catch { continue; }
    const fm = n.frontmatter;
    if (fm.status === 'deprecated' && fm.id && fm.superseded_by) {
      idx.set(fm.id, fm.superseded_by);
    }
  }
  return idx;
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

function serialize(frontmatter, body) {
  // gray-matter stringify keeps key insertion order (healNote already ordered
  // them via KEY_ORDER); js-yaml dumps with sortKeys:false by default, so the
  // raw file has `id` first and follows KEY_ORDER. Verified empirically.
  return matter.stringify(body ?? '', frontmatter);
}

async function atomicRename(tmp, target, retries = 5) {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, target);
      return;
    } catch (e) {
      if ((e.code === 'EPERM' || e.code === 'EBUSY') && attempt < retries) {
        await new Promise(r => setTimeout(r, 50 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}

export async function writeNote(rootDir, targetPath, intent, opts = {}) {
  const today = todayISO(opts.today);
  const dir = dirname(targetPath);
  await mkdir(dir, { recursive: true });

  const existed = await exists(targetPath);
  const existing = existed ? await readNote(targetPath) : null;
  const supersededIndex = await buildSupersededIndex(rootDir);

  // 1. reconstruct to healthy
  const healed = healNote(intent, { existing, supersededIndex, today });

  // 2. serialize + write temp in same dir.
  //    Defense in depth (Bug 2): never write a file whose frontmatter has a
  //    duplicate top-level key. The root cause of the one observed corruption
  //    (ASMP-001 with ~21 alternating title/other lines) is unconfirmed; this
  //    assert — before the temp write and atomic rename — guarantees a corrupt
  //    file is never produced or committed.
  const text = serialize(healed.frontmatter, healed.body);
  assertNoDuplicateFrontmatterKeys(text);
  const nonce = `${process.pid}-${attemptCounter()}`;
  const tmp = join(dir, `.${healed.frontmatter.id}.${nonce}.tmp`);
  await writeFile(tmp, text, 'utf8');

  // 3. local validate (parse + schema for this type)
  try {
    const { validatorFor } = await loadValidators();
    const reparsed = matter(await readFile(tmp, 'utf8'));
    const validate = validatorFor(reparsed.data.type);
    if (!validate(reparsed.data)) {
      const detail = (validate.errors ?? []).map(e => `${e.instancePath || '/'} ${e.message}`).join('; ');
      throw new Error(`write-note: local validation failed for ${healed.frontmatter.id} — ${detail}`);
    }
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }

  // 4. atomic rename (with Windows retry)
  await atomicRename(tmp, targetPath);

  // 5. rename-in-place: a write for an existing id must leave EXACTLY ONE file
  //    for that id. When the title (and thus the slug filename) changes, the new
  //    file lands at a new path while the old-slug file for the same id lingers,
  //    which `validate` then reports as a duplicate id. Sweep knowledge/** for any
  //    OTHER file belonging to this id and remove it. Uses Node fs (walkMarkdown),
  //    never shell globbing — filenames are Cyrillic / non-ASCII.
  await removeStaleIdSiblings(rootDir, healed.frontmatter.id, targetPath);

  return { path: targetPath, created: !existed };
}

// Remove every *.md under knowledge/** whose basename belongs to `id`
// (`${id}-<slug>.md` or `${id}.md`) except `keepPath`.
async function removeStaleIdSiblings(rootDir, id, keepPath) {
  if (!id) return;
  const keep = resolve(keepPath);
  const prefix = `${id}-`;
  const exact = `${id}.md`;
  let files;
  try {
    files = await walkMarkdown(join(rootDir, 'knowledge'));
  } catch {
    return;
  }
  for (const fp of files) {
    const name = basename(fp);
    const sameId = name === exact || name.startsWith(prefix);
    if (!sameId) continue;
    if (resolve(fp) === keep) continue;
    await unlink(fp).catch(() => {});
  }
}

let _c = 0;
function attemptCounter() { return (_c = (_c + 1) % 1e6); }

export function targetPathFor(rootDir, domainDir, id, title) {
  const slug = slugify(title) || String(id).toLowerCase();
  return join(rootDir, 'knowledge', domainDir, `${id}-${slug}.md`);
}
