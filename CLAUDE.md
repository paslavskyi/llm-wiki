# LLM-Wiki — LLM-native product knowledge base

This repository is a **knowledge system**, not product code. It captures and
systematizes everything known about the product so that specs, roadmap, KPIs,
and go-to-market can be built on top. The interface to this knowledge is an LLM.

## Three layers
1. **Knowledge** (`knowledge/`) — atomic Markdown notes with YAML frontmatter.
   The single source of truth. Written by humans / in dialogue.
2. **Indexes** (`index/`) — GENERATED routing layer. Never edit by hand.
3. **State** (`STATE.md`) — current non-derivable *intent* only (focus + next step). NOT counts or
   progress (those are generated in `index/`). There is no `journal/`; history lives in git (`kb-recap`).

## Session protocol (do this every session)
1. Read `kb.config.yml` — sets `mode` (debug/autonomous) and `language`.
2. Run the **`kb-orient`** skill — reads `STATE.md` + `index/MAP.md` to learn
   where we are and what's next. Do NOT read the whole repo.
3. Capture knowledge ONLY through the **`kb-capture`** skill.
4. Retrieve knowledge through the **`kb-recall`** skill (index-first).

## Invariants (do not violate)
- Never edit files in `index/` or `docs/` by hand — they are generated.
- **STATE.md scope**: `STATE.md` holds ONLY non-derivable intent (current focus + next step). Never
  copy derived facts into it — note counts, per-domain progress, and open `Q-`/`RISK-`/`ASMP-` lists
  belong to the generated `index/MAP.md` + `index/health.md`. Reference them; don't duplicate (a copy
  has no invalidation and silently drifts). If STATE and an index disagree, the index wins.
- Never read the whole knowledge base — navigate index-first (MAP → domain index → note).
- Every note has a stable `id`; once assigned, an id is never reused or deleted.
- A note's filename must start with its `id` (e.g., `FR-001-budget.md`).
- Capture knowledge only via `kb-capture`; do not hand-write notes ad hoc.
- All note writes go through the write pipeline (`tools/write-note.mjs` via
  `kb-capture`/`kb-evolve`); never raw-write or hand-edit notes. Every write
  reconstructs the note to a healthy state (rule_set in `lib/heal.mjs`).
- To retire a note, deprecate it (`status: deprecated` + `superseded_by`) — never
  reuse or delete an id. Same-prefix change = rename-in-place; different-prefix =
  tombstone migration (see `kb-evolve`).

## Type & ID vocabulary
| Domain | type | ID prefix |
|---|---|---|
| vision | vision, principle, value-prop | VIS- |
| market | competitor, market-insight | CMP-, MKT- |
| users | persona, segment, jtbd, pain | PER-, SEG-, JTBD-, PAIN- |
| product | feature, requirement, nfr, story, entity, term | FEAT-, FR-, NFR-, STORY-, ENT-, TERM- |
| mindmap | topic | TOP- |
| roadmap | milestone, kpi | MIL-, KPI- |
| gtm | positioning, channel, pricing, message | POS-, CHAN-, PRICE-, MSG- |
| cross-cutting | risk, assumption, question | RISK-, ASMP-, Q- |

`requirement` priority values: `must | should | could | wont`.

## Mind-map (Phase 2a)
- A `topic` note (`TOP-`) is a node of the mind-map. Its `parent` is a `TOP-` id or `null` (top-level area = a folder).
- A concrete note attaches to a node via its `topic: TOP-xxx` field.
- `parent`/`topic` must resolve to an existing `topic` note (validated).
- Generated views: `index/mindmap.md` (text, auto), `index/mindmap.html` (graphical, via `kb-visualize`).
- Dialogue engine: run **`kb-elicit`** to gather knowledge; **`kb-visualize`** to see the graphical map. Stage-0 seed is `kb.framework.yml`.

## Health & evolution (Phase 2b)
- `index/health.md` (GENERATED) reports actionable signals: migration debt, open
  `Q-`/`RISK-`/`ASMP-`, empty topic nodes; plus heuristic orphans (and opt-in
  duplicates via `kb.config.yml` `health.duplicates`). Regenerate: `npm run graph`.
- `npm run impact -- <ID>` shows a note's blast radius before evolving it.
- `npm run install-hooks` installs the git pre-commit guard (validate = gate;
  reindex + graph = informational).
- Evolve notes with **`kb-evolve`**; clear migration debt in bulk with **`kb-sanitize`**.

## Persistence & recap (Phase 2c)
- Persistence is automatic and invisible: a UserPromptSubmit hook evaluates
  uncommitted `knowledge/` changes (untracked/modified/deleted) every message.
  Per `kb.config.yml` `persistence.autocommit`: `off` (silent), `manual` (nudge
  you to commit; debounced), `auto` (the hook instructs me to commit with a
  meaningful message before replying). `mode` (tone) and `autocommit` (git
  behavior) are independent.
- When the hook asks for a commit, commit `knowledge/` + `index/` with a concise
  message describing what changed. (An optional `hard_safety_net` makes a
  technical commit only if reminders are repeatedly ignored; off by default.)
- **`kb-recap`** (optional, read-only): summarize changes over a time range or
  area from git history. It saves nothing — git is the only history store. There
  is no `journal/`.

## Folder map
- `knowledge/<domain>/...` — source notes
- `index/` — generated (MAP, per-domain indexes, backlinks.json)
- `tools/` — Node scripts: `validate.mjs`, `reindex.mjs`
- `.claude/skills/` — kb-orient, kb-capture, kb-recall, kb-elicit, kb-visualize, kb-evolve, kb-sanitize

## Tooling
- `npm run kb:write` — batch-write notes through the heal/validate pipeline.
  JSON on stdin: `[{domainDir, frontmatter, body}]` (body = string or string[] of
  lines). For coherent multi-note writes/updates; a single note still goes via
  `kb-capture`. Avoids ad-hoc temp scripts and JS-string escaping pitfalls.
- `npm run validate` — validate all notes (also runs automatically after writes).
- `npm run reindex` — regenerate `index/` (also runs automatically at end of turn).
- `npm test` — run the tool test suite.

## Mode
`mode: debug` (default) — report reads/writes/changes explicitly.
`mode: autonomous` — short human acknowledgements only; hide wiki mechanics. (Phase 2.)
