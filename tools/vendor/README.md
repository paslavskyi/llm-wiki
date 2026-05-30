# Vendored browser assets

Committed so the generated `index/mindmap.html` works fully offline (no CDN).
Do not edit by hand — re-download to upgrade.

| File | Package | Version | Source URL | License |
|---|---|---|---|---|
| d3.min.js | d3 | 7.9.0 | https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js | BSD-3-Clause |
| markmap-view.min.js | markmap-view | 0.18.10 | https://cdn.jsdelivr.net/npm/markmap-view@0.18.10/dist/browser/index.js | MIT |

To upgrade: re-run the curl commands in the Phase 2a plan (Task 5) with new
versions and update this table.

## Browser API (verified against markmap-view@0.18.10)

The UMD bundle assigns the global `window.markmap` (top-level
`})(this.markmap = this.markmap || {}, d3)`), exposing `window.markmap.Markmap`.
Render with:

```js
const mm = window.markmap.Markmap.create(svgEl, opts, null);
mm.setData(data).then(() => mm.fit());
```

`Markmap.create(svg, opts, data=null)` accepts a CSS selector string, an element,
or a d3 selection as `svg` (constructor does `svg.datum ? svg : d3.select(svg)`).
When `data` is passed inline, `create` internally calls `setData(data).then(fit)`;
we pass `null` and drive `setData`/`fit` ourselves so the fit happens reliably
after the async layout resolves.
