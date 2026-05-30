---
name: kb-visualize
description: Use to generate or refresh the graphical, interactive mind-map of the knowledge base and tell the user how to open it in a browser. Renders the topic graph as a self-contained offline HTML file.
---

# kb-visualize — graphical mind-map

Goal: produce an interactive, zoomable mind-map the human can open in a browser.

## Steps
1. Run `node tools/mindmap-html.mjs` (or `npm run mindmap`) to regenerate
   `index/mindmap.html` from the current topic graph.
2. Tell the user the path and how to open it:
   - Windows: `start index/mindmap.html`
   - macOS: `open index/mindmap.html`
   - or open the `file://` path in any browser.
3. Optionally summarize what's shown (number of areas / sub-topics / notes), read
   from `index/mindmap.md` — do not open the whole knowledge tree.

## Output (per mode)
- `debug`: confirm the file was regenerated and give the open command.
- `autonomous`: short acknowledgement + how to open it.

## Notes
- `index/mindmap.html` is GENERATED — never edit by hand.
- The file is fully offline (vendored d3 + markmap-view under `tools/vendor/`).
- This skill is independent of `kb-elicit`; run it anytime.
