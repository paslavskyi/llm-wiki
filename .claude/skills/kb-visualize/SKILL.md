---
name: kb-visualize
description: Use to show the graphical, interactive mind-map of the knowledge base. Primary view: the live dashboard's «Мапа» tab (kb-dashboard). Fallback: regenerate the offline self-contained index/mindmap.html.
---

# kb-visualize — graphical mind-map

Goal: let the human see and navigate the topic graph in a browser.

## Primary: live map in the dashboard (DEC-031/032)
1. Ensure the dashboard server runs (`kb-dashboard` skill / `npm run dashboard`).
2. Point the user to **http://localhost:4321 → вкладка «Мапа»**.
   - Always current (computed from knowledge/ per request; ⟳/F5 refreshes).
   - Click a node → the full note opens in the drawer (scope, links, backlinks).
   - Double-click collapses/expands a branch; mouse wheel zooms; drag pans.

## Fallback: offline artifact (no server needed)
1. Run `node tools/mindmap-html.mjs` (or `npm run mindmap`) to regenerate
   `index/mindmap.html` from the current topic graph.
2. Open it: Windows `start index/mindmap.html` (fully offline, vendored d3 +
   markmap; view-only — no click-through to notes).

## Notes
- `index/mindmap.html` is GENERATED — never edit by hand (and it is gitignored).
- Optionally summarize what's shown (areas / sub-topics / notes) from
  `index/mindmap.md` — do not open the whole knowledge tree.
- This skill is independent of `kb-elicit`; run it anytime.
