import { join, dirname } from 'node:path';
import { writeFile, readFile, rename, unlink, mkdir, access } from 'node:fs/promises';
import matter from 'gray-matter';
import { walkMarkdown } from '../lib/walk.mjs';
import { readNote } from '../lib/note.mjs';
import { healNote, slugify } from '../lib/heal.mjs';
import { loadValidators } from '../lib/schemas.mjs';

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

  // 2. write temp in same dir
  const nonce = `${process.pid}-${attemptCounter()}`;
  const tmp = join(dir, `.${healed.frontmatter.id}.${nonce}.tmp`);
  await writeFile(tmp, serialize(healed.frontmatter, healed.body), 'utf8');

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

  return { path: targetPath, created: !existed };
}

let _c = 0;
function attemptCounter() { return (_c = (_c + 1) % 1e6); }

export function targetPathFor(rootDir, domainDir, id, title) {
  const slug = slugify(title) || String(id).toLowerCase();
  return join(rootDir, 'knowledge', domainDir, `${id}-${slug}.md`);
}
