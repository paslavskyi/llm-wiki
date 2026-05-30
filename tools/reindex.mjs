import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { walkMarkdown } from '../lib/walk.mjs';
import { readNote } from '../lib/note.mjs';
import { domainOf } from '../lib/domain.mjs';
import { buildTree } from '../lib/mindmap.mjs';

const BANNER = '<!-- GENERATED — do not edit by hand. Run: npm run reindex -->';

// Escape a value for safe interpolation into a Markdown table cell:
// collapse newlines to spaces and escape pipes so a value can't split the row.
function cell(v) {
  return String(v ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

export async function buildIndexes(rootDir) {
  const knowledgeDir = join(rootDir, 'knowledge');
  const filePaths = await walkMarkdown(knowledgeDir);

  const notes = [];
  for (const fp of filePaths) {
    let note;
    try {
      note = await readNote(fp);
    } catch {
      // Skip notes with malformed frontmatter; `validate` reports these.
      continue;
    }
    notes.push({ ...note, domain: domainOf(fp) });
  }

  // group by domain
  const byDomain = new Map();
  for (const n of notes) {
    if (!byDomain.has(n.domain)) byDomain.set(n.domain, []);
    byDomain.get(n.domain).push(n);
  }
  for (const list of byDomain.values()) {
    list.sort((a, b) => String(a.frontmatter.id).localeCompare(String(b.frontmatter.id)));
  }

  // backlinks
  const backlinks = {};
  for (const n of notes) {
    if (!n.frontmatter.id) continue;
    for (const target of n.links) {
      (backlinks[target] ??= []).push(n.frontmatter.id);
    }
  }
  for (const k of Object.keys(backlinks)) {
    backlinks[k] = [...new Set(backlinks[k])].sort();
  }

  const files = {};

  // MAP.md
  const domains = [...byDomain.keys()].sort();
  let map = `${BANNER}\n\n# Knowledge Map\n\nTotal notes: ${notes.length}\n\n`;
  map += `| Domain | Notes | Index |\n|---|---|---|\n`;
  for (const d of domains) {
    map += `| ${cell(d)} | ${byDomain.get(d).length} | [${cell(d)}](./${d}.index.md) |\n`;
  }
  map += `\nNavigation: read this MAP → open the relevant \`<domain>.index.md\` → open only the note files you need.\n`;
  files['index/MAP.md'] = map;

  // per-domain indexes
  for (const d of domains) {
    let idx = `${BANNER}\n\n# Index: ${d}\n\n`;
    idx += `| id | title | status | priority | summary |\n|---|---|---|---|---|\n`;
    for (const n of byDomain.get(d)) {
      const fm = n.frontmatter;
      idx += `| ${cell(fm.id ?? '(no id)')} | ${cell(fm.title)} | ${cell(fm.status)} | ${cell(fm.priority)} | ${cell(fm.summary)} |\n`;
    }
    files[`index/${d}.index.md`] = idx;
  }

  // backlinks.json (stable key order)
  const ordered = {};
  for (const k of Object.keys(backlinks).sort()) ordered[k] = backlinks[k];
  files['index/backlinks.json'] = JSON.stringify(ordered, null, 2) + '\n';

  // mindmap.md — nested tree from topic graph
  const { roots, unassigned } = buildTree(notes);
  let mm = `${BANNER}\n\n# Mind-map\n\n`;
  const renderNode = (node, depth) => {
    const pad = '  '.repeat(depth);
    mm += `${pad}- **${cell(node.id)}** ${cell(node.title)}\n`;
    for (const child of node.children) renderNode(child, depth + 1);
    for (const n of node.notes) {
      mm += `${'  '.repeat(depth + 1)}- ${cell(n.id)} ${cell(n.title)}\n`;
    }
  };
  if (roots.length === 0 && unassigned.length === 0) {
    mm += `_No topics yet. Run the kb-elicit skill to frame the map._\n`;
  } else {
    for (const root of roots) renderNode(root, 0);
  }
  if (unassigned.length) {
    mm += `\n## (unassigned)\n\n`;
    for (const n of unassigned) mm += `- ${cell(n.id)} ${cell(n.title)}\n`;
  }
  files['index/mindmap.md'] = mm;

  return { files };
}

export async function writeIndexes(rootDir) {
  const { files } = await buildIndexes(rootDir);
  await mkdir(join(rootDir, 'index'), { recursive: true });
  for (const [rel, contents] of Object.entries(files)) {
    await writeFile(join(rootDir, rel), contents, 'utf8');
  }
  return Object.keys(files);
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? process.cwd();
  const written = await writeIndexes(root);
  console.log(`✓ regenerated ${written.length} index file(s)`);
}
