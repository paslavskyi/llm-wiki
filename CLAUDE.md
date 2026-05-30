# abc-budget — LLM-native product knowledge base

This repository is a **knowledge system**, not product code. It captures and
systematizes everything known about the product so that specs, roadmap, KPIs,
and go-to-market can be built on top. The interface to this knowledge is an LLM.

## Three layers
1. **Knowledge** (`knowledge/`) — atomic Markdown notes with YAML frontmatter.
   The single source of truth. Written by humans / in dialogue.
2. **Indexes** (`index/`) — GENERATED routing layer. Never edit by hand.
3. **State** (`STATE.md`, `journal/`) — where we are + history between sessions.

## Session protocol (do this every session)
1. Read `kb.config.yml` — sets `mode` (debug/autonomous) and `language`.
2. Run the **`kb-orient`** skill — reads `STATE.md` + `index/MAP.md` to learn
   where we are and what's next. Do NOT read the whole repo.
3. Capture knowledge ONLY through the **`kb-capture`** skill.
4. Retrieve knowledge through the **`kb-recall`** skill (index-first).

## Invariants (do not violate)
- Never edit files in `index/` or `docs/` by hand — they are generated.
- Never read the whole knowledge base — navigate index-first (MAP → domain index → note).
- Every note has a stable `id`; once assigned, an id is never reused or deleted.
- A note's filename must start with its `id` (e.g., `FR-001-budget.md`).
- Capture knowledge only via `kb-capture`; do not hand-write notes ad hoc.

## Type & ID vocabulary
| Domain | type | ID prefix |
|---|---|---|
| vision | vision, principle, value-prop | VIS- |
| market | competitor, market-insight | CMP-, MKT- |
| users | persona, segment, jtbd, pain | PER-, SEG-, JTBD-, PAIN- |
| product | feature, requirement, nfr, story, entity, term | FEAT-, FR-, NFR-, STORY-, ENT-, TERM- |
| roadmap | milestone, kpi | MIL-, KPI- |
| gtm | positioning, channel, pricing, message | POS-, CHAN-, PRICE-, MSG- |
| cross-cutting | risk, assumption, question | RISK-, ASMP-, Q- |

`requirement` priority values: `must | should | could | wont`.

## Folder map
- `knowledge/<domain>/...` — source notes
- `index/` — generated (MAP, per-domain indexes, backlinks.json)
- `tools/` — Node scripts: `validate.mjs`, `reindex.mjs`
- `.claude/skills/` — kb-orient, kb-capture, kb-recall

## Tooling
- `npm run validate` — validate all notes (also runs automatically after writes).
- `npm run reindex` — regenerate `index/` (also runs automatically at end of turn).
- `npm test` — run the tool test suite.

## Mode
`mode: debug` (default) — report reads/writes/changes explicitly.
`mode: autonomous` — short human acknowledgements only; hide wiki mechanics. (Phase 2.)
