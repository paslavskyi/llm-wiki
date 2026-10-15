import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadNotes } from '../lib/load-notes.mjs';
import { buildTree } from '../lib/mindmap.mjs';
import { jaroWinkler, normalizeForCompare } from '../lib/jaro-winkler.mjs';
import { loadConfig } from '../lib/config.mjs';
import { OPEN_TYPES, isOpenNote } from '../lib/open.mjs';
import { EVIDENCE_TYPES } from '../lib/vocabulary.mjs';
import { findMarkers } from '../lib/markers.mjs';

const BANNER = '<!-- GENERATED — do not edit by hand. Run: node tools/graph.mjs -->';

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

  // Tier 1.2 open Q/RISK/ASMP (shared definition — lib/open.mjs)
  const openTypes = OPEN_TYPES;
  const open = notes
    .filter(n => isOpenNote(n.frontmatter))
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

  // Tier 1.4 unresolved inline markers ([NEEDS CLARIFICATION] / [ASSUMPTION])
  const marked = notes
    .filter(n => n.frontmatter.id && n.frontmatter.status !== 'deprecated')
    .map(n => {
      const ms = findMarkers(n.body);
      const q = ms.filter(m => m.kind === 'NEEDS CLARIFICATION').length;
      return { id: n.frontmatter.id, q, a: ms.length - q };
    })
    .filter(m => m.q + m.a > 0)
    .sort((x, y) => x.id.localeCompare(y.id));

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

  // Tier 2.2 provenance: accepted claims with no evidence; sources nothing cites
  const unsupported = notes
    .filter(n => EVIDENCE_TYPES.has(n.frontmatter.type) && n.frontmatter.status === 'accepted'
      && !(n.frontmatter.sources ?? []).length)
    .map(n => n.frontmatter.id).sort();
  const unusedSources = notes
    .filter(n => n.frontmatter.type === 'source' && n.frontmatter.status !== 'deprecated'
      && !(backlinks.get(n.frontmatter.id) ?? []).length)
    .map(n => n.frontmatter.id).sort();

  // Tier 2.3 possible duplicates (opt-in)
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
  md += `\n### Unresolved markers (inline clarifications / assumptions)\n`;
  md += marked.length
    ? marked.map(m => `- ${m.id} — ${m.q} clarification, ${m.a} assumption`).join('\n') + '\n'
    : '_none_\n';
  md += `\n### Empty topic nodes (no attached notes)\n`;
  md += emptyTopics.length ? emptyTopics.map(id => `- ${id}`).join('\n') + '\n' : '_none_\n';
  md += `\n## Tier 2 — may need attention (heuristic)\n\n`;
  md += `### Orphan notes (no links in or out)\n`;
  md += orphans.length ? orphans.map(id => `- ${id}`).join('\n') + '\n' : '_none_\n';
  md += `\n### Accepted claims without evidence\n`;
  md += unsupported.length ? unsupported.map(id => `- ${id}`).join('\n') + '\n' : '_none_\n';
  md += `\n### Unused sources\n`;
  md += unusedSources.length ? unusedSources.map(id => `- ${id}`).join('\n') + '\n' : '_none_\n';
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
