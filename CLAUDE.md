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
- Never edit files in `index/` by hand — they are generated.
- **STATE.md scope**: `STATE.md` holds ONLY non-derivable intent (current focus + next step). Never
  copy derived facts into it — note counts, per-domain progress, and open `Q-`/`RISK-`/`ASMP-` lists
  belong to the generated `index/MAP.md` + `index/health.md`. Reference them; don't duplicate (a copy
  has no invalidation and silently drifts). If STATE and an index disagree, the index wins.
- Inline uncertainty markers `[NEEDS CLARIFICATION: …]` / `[ASSUMPTION: …]` keep a
  local gap visible in the note body; a note cannot be `accepted` while any remain
  (enforced; listed in `index/health.md`).
- Never read the whole knowledge base — navigate index-first (MAP → domain index → note).
- Every note has a stable `id`; once assigned, an id is never reused or deleted.
- A note's filename must start with its `id` (e.g., `FR-001-budget.md`).
- A note's `type`, id prefix and domain folder must agree with the vocabulary
  below (data: `lib/vocabulary.mjs`; enforced by `validate` and the write
  pipeline). New ids are assigned by the pipeline, never picked by hand.
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
| roadmap | milestone, kpi, goal, plan, timeline | MIL-, KPI-, GOAL-, PLAN-, TL- |
| gtm | positioning, channel, pricing, message | POS-, CHAN-, PRICE-, MSG- |
| cross-cutting | risk, assumption, question | RISK-, ASMP-, Q- |
| decisions | decision | DEC- |
| sources | source | SRC- |

Typed relations (`lib/relations.mjs`): `relations: { <name>: [ids] }`, declared once
on the owning note; the inverse is derived into `index/relations.json`. Allowed
pairs are enforced:
| relation | from | to | inverse |
|---|---|---|---|
| refines | feature/requirement/nfr/story | feature/requirement/nfr/jtbd/goal | refined_by |
| addresses | feature/requirement/nfr/story/value-prop/decision | pain/jtbd | addressed_by |
| serves | feature/requirement/nfr/story/value-prop/positioning/message/channel/pricing | persona/segment | served_by |
| mitigates | feature/requirement/nfr/story/decision/milestone | risk | mitigated_by |
| measures | kpi | goal/milestone/vision/value-prop/feature/requirement/nfr/story | measured_by |
| answers | any | question | answered_by |
| depends_on | any | any | required_by |
| conflicts_with | any | any | conflicts_with |

Use `links:` only for a plain "see also" that no relation describes.

A `source` note (`SRC-`, required `kind`: interview | conversation | document | url |
research | survey | analytics | observation; optional `origin`) is evidence: its body
keeps the verbatim quote/excerpt. Any note cites evidence via `sources: [SRC-…]`.
Accepted persona/segment/jtbd/pain/competitor/market-insight notes with no
`sources`, and sources nothing cites, are flagged in `index/health.md`.

`topic` and the cross-cutting types live in any domain folder; every other type
lives only in its own domain folder.

`requirement` priority values: `must | should | could | wont`.

Acceptance criteria (requirement / nfr / story): `acceptance: [{id, text, verify?}]`.
Write `text` as EARS (`WHEN … THE SYSTEM SHALL …`; uk: `КОЛИ … СИСТЕМА ПОВИННА …`)
or Given/When/Then (uk: ДАНО/КОЛИ/ТОДІ); a plain string list is fine — the pipeline
assigns ids `<NOTE-ID>.<n>` and never renumbers. Cite one criterion as `FR-012.1`
(links/relations/`[[FR-012.1]]`; validated). Health flags criteria in neither form
and quality words (fast, secure, зручно…) with no number; coverage flags
must-requirements and stories without criteria.

The `decisions` domain is the product/architecture decision log (ADR-style): one
note per significant decision, each recording context, the decision, rationale,
and consequences. A decision that was later changed records the supersession in
its body; the live note states the current verdict.

## Goals & operational plan
- **`goal` (GOAL-)** — a thematic product goal: title + description + `scope`
  (ids of member notes). Progress is COMPUTED from scope statuses — never
  stored. Goals are independent of the plan. Create/edit ONLY via **`kb-goal`**.
- **`plan` (PLAN-001, singleton)** — the operational plan: `active` (WIP),
  `queue` (TODO; LIST ORDER = execution sequence), `backlog` (parked). **done
  is never stored** — derived from the plan note's git history. Change ONLY via
  **`kb-plan`** → `npm run plan -- <verb>` (never Write/Edit/kb:write): the CLI
  heals, validates (singleton, disjoint lists, live ids), reindexes, and makes
  the atomic commit whose message the done-history relies on.
- **`milestone` (MIL-)** — a concrete stage of product development. Semantics:
  `proposed` = planned, `accepted` = reached; optional `due` (YYYY-MM-DD). The
  ordered product ladder lives in the singleton **`timeline` TL-001**
  (`sequence: [MIL-ids]`). Product states (done / in work / overdue / next /
  planned) and the «we are here» point are DERIVED (status + due + PLAN-001) —
  never stored.
- Live PM dashboard: **`kb-dashboard`** → `npm run dashboard` →
  http://localhost:4321 (read-only viewer; tabs: Продукт / Розробка / Мапа / KB).

## Mind-map
- A `topic` note (`TOP-`) is a node of the mind-map. Its `parent` is a `TOP-` id or `null` (top-level area = a folder).
- A concrete note attaches to a node via its `topic: TOP-xxx` field.
- `parent`/`topic` must resolve to an existing `topic` note (validated).
- Generated views: `index/mindmap.md` (text, auto), `index/mindmap.html` (graphical, via `kb-visualize`).
- Dialogue engine: run **`kb-elicit`** to gather knowledge; **`kb-visualize`** to see the graphical map. Stage-0 seed is `kb.framework.yml`.

## Health & evolution
- `index/health.md` (GENERATED) reports actionable signals: migration debt, open
  `Q-`/`RISK-`/`ASMP-`, empty topic nodes; plus heuristic orphans (and opt-in
  duplicates via `kb.config.yml` `health.duplicates`). Regenerates automatically
  (Stop hook + pre-commit); manual: `npm run graph`.
- `index/coverage.md` (GENERATED by reindex) checks expected connections, rules as
  data in `lib/coverage.mjs`: must-requirements without story/feature/milestone,
  features that address/serve nothing, personas without JTBD/pain, unaddressed
  pains, unmitigated open risks, KPIs measuring nothing, goals with empty scope.
- `npm run impact -- <ID>` shows a note's blast radius before evolving it.
- `npm run install-hooks` installs the git pre-commit guard (validate = gate;
  reindex + graph = informational).
- Evolve notes with **`kb-evolve`**; clear migration debt in bulk with **`kb-sanitize`**.

## Persistence & recap
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
- `index/` — generated (MAP, per-domain indexes, backlinks.json, relations.json,
  coverage.md, health.md)
- `tools/` — Node CLIs: write pipeline (`write-note.mjs`, `kb-write.mjs`),
  `validate.mjs`, `reindex.mjs`, `graph.mjs`, `impact.mjs`, `plan.mjs`,
  `mindmap-html.mjs`, `dashboard/`, hooks (`user-prompt-hook.mjs`,
  `should-commit.mjs`, `auto-commit.mjs`, `session-delta.mjs`, `hooks/`,
  `install-hooks.mjs`); JSON schemas in `tools/schema/`, vendored JS in `tools/vendor/`
- `lib/` — pure/shared modules (heal, vocabulary, schemas, config, plan, mind-map…)
- `test/` — `node --test` suite for `lib/` + `tools/`
- `docs/superpowers/` — the engine's own design specs & build plans (history,
  not product knowledge; safe to delete in a fork)
- `.claude/skills/` — kb-orient, kb-capture, kb-recall, kb-elicit, kb-visualize,
  kb-evolve, kb-sanitize, kb-recap, kb-goal, kb-plan, kb-dashboard

## Tooling
- `npm run kb:write` — batch-write notes through the heal/validate pipeline.
  JSON on stdin: `[{domainDir, frontmatter, body}]` (body = string or string[] of
  lines). Omit `frontmatter.id` for a new note — the next free id for the
  type is assigned and printed. For coherent multi-note writes/updates; a single note still goes via
  `kb-capture`. Avoids ad-hoc temp scripts and JS-string escaping pitfalls.
- `npm run clarify -- [--topic TOP-x] [--limit N]` — ranked queue of open `Q-` notes
  and inline markers for kb-elicit's clarify loop (read-only).
- `npm run validate` — validate all notes (also runs automatically after writes).
- `npm run reindex` — regenerate `index/` (also runs automatically at end of turn).
- `npm run plan -- <show|take|done|drop|defer|promote|move|set>` — deterministic
  operational-plan surgery (used by kb-plan; never edit the plan note by hand).
- `npm run dashboard` — live read-only PM dashboard (http://localhost:4321).
- `npm test` — run the tool test suite.

## Mode
`mode: debug` (default) — report reads/writes/changes explicitly.
`mode: autonomous` — short human acknowledgements only; hide wiki mechanics.
