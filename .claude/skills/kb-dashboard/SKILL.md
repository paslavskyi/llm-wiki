---
name: kb-dashboard
description: Use to start (or point the user to) the live PM dashboard of this knowledge base — "де ми зараз", активні цілі, backlog, відкриті ризики/питання, пульс KB. Runs a local read-only server; data is always current (computed from knowledge/ frontmatter + git at request time).
---

# kb-dashboard — live PM dashboard

Goal: give the human a visual, always-fresh view of project state without any
regeneration step. Architecture: DEC-031 (hand-written SPA + read-only REST API).

## Steps
1. Start the server (if not already running):
   - `npm run dashboard` (foreground; Ctrl+C to stop), or run it in the
     background if the session needs to continue working.
   - Port: 4321 by default (`KB_DASH_PORT` env var to override). Binds 127.0.0.1.
2. Tell the user to open **http://localhost:4321** (Windows: `start http://localhost:4321`).
3. Data refreshes on every browser reload (F5) or the «оновити» button — no
   regeneration command exists or is needed.

## What it shows
- Prompt-line header: branch, last commit, live note count, uncommitted knowledge/ changes.
- «Де ми зараз» — Current focus + Phase from `STATE.md`.
- Stat tiles: живі нотатки, активні цілі (accepted MIL-*), backlog, відкриті RISK-/Q-.
- Milestones (фільтр: активні/заплановані/всі), Backlog (tag `backlog` + proposed MIL-*).
- Health: відкриті question/risk/assumption (same rule as `index/health.md`).
- Charts: нотатки за доменами; пульс KB (created/updated by month).

## Rules
- The dashboard is a VIEWER. The API is GET-only and never writes to the KB;
  all knowledge writes still go exclusively through the write pipeline.
- `tools/dashboard/` is hand-maintained SOURCE code (not a generated artifact —
  it does not live in `index/`). Vendored libs live in `tools/dashboard/public/vendor/`.
- Do not add write endpoints. Ever. (DEC-031.)
