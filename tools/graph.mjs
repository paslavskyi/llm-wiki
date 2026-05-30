import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { walkMarkdown } from '../lib/walk.mjs';
import { readNote } from '../lib/note.mjs';
import { buildTree } from '../lib/mindmap.mjs';
import { jaroWinkler, normalizeForCompare } from '../lib/jaro-winkler.mjs';
import { loadConfig } from '../lib/config.mjs';

const BANNER = '<!-- GENERATED — do not edit by hand. Run: node tools/graph.mjs -->';

async function loadNotes(rootDir) {
  const files = await walkMarkdown(join(rootDir, 'knowledge'));
  const notes = [];
  for (const fp of files) {
    try { notes.push(await readNote(fp)); } catch { /* validate reports parse errors */ }
  }
  return notes;
}

export async function buildHealth(rootDir, opts = {}) {
  const notes = await loadNotes(rootDir);
  const byId = new Map(notes.map(n => [n.frontmatter.id, n]).filter(([id]) => id));

  // backlinks: target -> [sources]
  const backlinks = new Map();
  for (const n of notes) {
    const src = n.frontmatter.id;
    if (!src) continue;
    for (const t of n.links) {
      if (!backlinks.has(t)) backlinks.set(t, []);
      backlinks.get(t).push(src);
    }
  }

  // Tier 1.1 migration debt: incoming link to a deprecated note
  const debt = [];
  for (const n of notes) {
    if (n.frontmatter.status !== 'deprecated') continue;
    const incoming = backlinks.get(n.frontmatter.id) ?? [];
    if (incoming.length) debt.push({ deprecated: n.frontmatter.id, from: [...new Set(incoming)].sort() });
  }
  debt.sort((a, b) => a.deprecated.localeCompare(b.deprecated));

  // Tier 1.2 open Q/RISK/ASMP
  const openTypes = new Set(['question', 'risk', 'assumption']);
  const open = notes
    .filter(n => openTypes.has(n.frontmatter.type) && n.frontmatter.status !== 'accepted')
    .map(n => n.frontmatter.id).filter(Boolean).sort();

  // Tier 1.3 empty topic nodes (topic with no attached concrete notes and no children)
  const { roots } = buildTree(notes);
  const emptyTopics = [];
  const walkTopic = (node) => {
    if (node.notes.length === 0 && node.children.length === 0) emptyTopics.push(node.id);
    node.children.forEach(walkTopic);
  };
  roots.forEach(walkTopic);
  emptyTopics.sort();

  // Tier 2.1 orphans: concrete notes with no links and no backlinks.
  // Exclude topics (structural) and open-type notes (question/risk/assumption are
  // inherently standalone and already surfaced by the Tier-1 open signal).
  const orphans = notes.filter(n => {
    const fm = n.frontmatter;
    if (fm.type === 'topic' || openTypes.has(fm.type) || !fm.id) return false;
    const hasOut = n.links.length > 0;
    const hasIn = (backlinks.get(fm.id) ?? []).length > 0;
    return !hasOut && !hasIn;
  }).map(n => n.frontmatter.id).sort();

  // Tier 2.2 possible duplicates (opt-in)
  const dupes = [];
  if (opts.duplicates) {
    const threshold = opts.threshold ?? 0.92;
    const byType = new Map();
    for (const n of notes) {
      if (!n.frontmatter.id || n.frontmatter.type === 'topic') continue;
      const t = n.frontmatter.type;
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t).push(n);
    }
    for (const list of byType.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = normalizeForCompare(list[i].frontmatter.title);
          const b = normalizeForCompare(list[j].frontmatter.title);
          if (!a || !b) continue;
          const score = jaroWinkler(a, b);
          if (score >= threshold) {
            dupes.push({ a: list[i].frontmatter.id, b: list[j].frontmatter.id, score: score.toFixed(3) });
          }
        }
      }
    }
    dupes.sort((x, y) => Number(y.score) - Number(x.score));
  }

  // render
  let md = `${BANNER}\n\n# Health report\n\n`;
  md += `## Tier 1 — actionable\n\n`;
  md += `### Migration debt (links to deprecated notes)\n`;
  md += debt.length ? debt.map(d => `- ${d.deprecated} ← ${d.from.join(', ')}`).join('\n') + '\n' : '_none_\n';
  md += `\n### Open questions / risks / assumptions\n`;
  md += open.length ? open.map(id => `- ${id}`).join('\n') + '\n' : '_none_\n';
  md += `\n### Empty topic nodes (no attached notes)\n`;
  md += emptyTopics.length ? emptyTopics.map(id => `- ${id}`).join('\n') + '\n' : '_none_\n';
  md += `\n## Tier 2 — may need attention (heuristic)\n\n`;
  md += `### Orphan notes (no links in or out)\n`;
  md += orphans.length ? orphans.map(id => `- ${id}`).join('\n') + '\n' : '_none_\n';
  if (opts.duplicates) {
    md += `\n### Possible duplicates (Jaro-Winkler ≥ ${opts.threshold ?? 0.92})\n`;
    md += dupes.length ? dupes.map(d => `- ${d.a} ~ ${d.b} (${d.score})`).join('\n') + '\n' : '_none_\n';
  }
  return { markdown: md };
}

export async function writeHealth(rootDir, opts = {}) {
  const { markdown } = await buildHealth(rootDir, opts);
  await mkdir(join(rootDir, 'index'), { recursive: true });
  await writeFile(join(rootDir, 'index', 'health.md'), markdown, 'utf8');
  return 'index/health.md';
}

// CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const cfg = await loadConfig(root);
  const cliDup = process.argv.includes('--duplicates');
  const opts = {
    duplicates: cliDup || cfg.health.duplicates.enabled,
    threshold: cfg.health.duplicates.threshold,
  };
  const out = await writeHealth(root, opts);
  console.log(`✓ generated ${out}`);
  process.exit(0);
}
