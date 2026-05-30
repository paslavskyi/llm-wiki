import { join, dirname } from 'node:path';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { walkMarkdown } from '../lib/walk.mjs';
import { readNote } from '../lib/note.mjs';
import { buildTree } from '../lib/mindmap.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BANNER = '<!-- GENERATED — do not edit by hand. Run: node tools/mindmap-html.mjs -->';

// Convert a buildTree node into the markmap-view data shape:
// { content, children }. Attached notes become leaf children.
function toMarkmapNode(node) {
  const children = [
    ...node.children.map(toMarkmapNode),
    ...node.notes.map(n => ({ content: `${n.id} ${n.title}`, children: [] })),
  ];
  return { content: `${node.id} ${node.title}`, children };
}

export async function buildMindmapHtml(rootDir) {
  const filePaths = await walkMarkdown(join(rootDir, 'knowledge'));
  const notes = [];
  for (const fp of filePaths) {
    try { notes.push(await readNote(fp)); } catch { /* validate reports */ }
  }
  const { roots, unassigned } = buildTree(notes);

  const children = roots.map(toMarkmapNode);
  if (unassigned.length) {
    children.push({
      content: '(unassigned)',
      children: unassigned.map(n => ({ content: `${n.id} ${n.title}`, children: [] })),
    });
  }
  const data = { content: 'Knowledge map', children };

  const d3 = await readFile(join(here, 'vendor', 'd3.min.js'), 'utf8');
  const view = await readFile(join(here, 'vendor', 'markmap-view.min.js'), 'utf8');
  const json = JSON.stringify(data);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Knowledge mind-map</title>
${BANNER}
<style>
  html, body { margin: 0; height: 100%; }
  #mindmap { display: block; width: 100vw; height: 100vh; }
</style>
</head>
<body>
<svg id="mindmap"></svg>
<script>${d3}</script>
<script>${view}</script>
<script>
  // markmap-view@0.18.10: UMD exposes window.markmap.Markmap.
  // create(svg, opts, data=null); when data is null we drive setData/fit
  // ourselves so fit() runs after the async layout has resolved.
  const data = ${json};
  const { Markmap } = window.markmap;
  const mm = Markmap.create('#mindmap', null, null);
  mm.setData(data).then(() => mm.fit());
</script>
</body>
</html>
`;
}

export async function writeMindmapHtml(rootDir) {
  const html = await buildMindmapHtml(rootDir);
  await mkdir(join(rootDir, 'index'), { recursive: true });
  await writeFile(join(rootDir, 'index', 'mindmap.html'), html, 'utf8');
  return 'index/mindmap.html';
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? process.cwd();
  const out = await writeMindmapHtml(root);
  console.log(`✓ generated ${out}`);
}
