# LLM-Wiki — LLM-native product knowledge base

A **knowledge system**, not product code: everything known about the product,
as atomic notes, so specs, roadmap, KPIs and go-to-market can be built on top.
The interface is an LLM (you).

## Layers
1. **Knowledge** (`knowledge/<domain>/`) — Markdown notes with YAML frontmatter;
   the single source of truth.
2. **Indexes** (`index/`) — GENERATED; never edit by hand. `MAP.md` → domain
   indexes (routing), `backlinks.json`, `relations.json` (typed edges + inverses),
   `coverage.md` (expected connections), `health.md` (what needs attention),
   `mindmap.md`.
3. **State** (`STATE.md`) — non-derivable intent only (focus + next step).
   History lives in git (`kb-recap`); there is no journal.

## Session protocol
1. A SessionStart hook injects a `[kb] session snapshot` (mode, language, focus,
   plan, attention counts). Respond in its `language`, in its `mode`.
2. Before substantial work run **`kb-orient`** for the full picture (never the
   whole repo).
3. Capture only via **`kb-capture`**; retrieve via **`kb-recall`** (index-first).

## Invariants
- Never read the whole knowledge base — MAP → domain index → note.
- Never edit `index/` by hand.
- **STATE.md scope**: never copy derived facts (counts, progress, open
  `Q-`/`RISK-`/`ASMP-` lists) into STATE.md — reference the indexes. If they
  disagree, the index wins. (Enforced by `validate`.)
- All note writes go through the pipeline (`npm run kb:write` / `kb-capture` /
  `kb-evolve`); never raw-write or hand-edit a note. It heals the note
  (`lib/heal.mjs`), validates and writes atomically.
- Ids: stable, assigned by the pipeline (omit `id` for a new note), never reused
  or deleted; the filename starts with the id. `type`, id prefix and domain
  folder must agree with the vocabulary below (`lib/vocabulary.mjs`).
- Retire a note by deprecating it (`status: deprecated` + `superseded_by`);
  same-prefix change = rename-in-place, different prefix = tombstone (`kb-evolve`).
- Never guess silently: mark gaps `[NEEDS CLARIFICATION: …]` / `[ASSUMPTION: …]`;
  a note with markers cannot be `accepted`.
- **Before writing or changing a note, read its type's section in
  `.claude/skills/kb-capture/formats.md`** (relations, evidence, acceptance
  criteria, assumptions, decisions, goals/plan/timeline, mind-map fields).

## Type & ID vocabulary
| Domain | type | ID prefix |
|---|---|---|
| vision | vision, principle, value-prop | VIS- |
| market | competitor, market-insight | CMP-, MKT- |
| users | persona, segment, jtbd, pain | PER-, SEG-, JTBD-, PAIN- |
| product | feature, requirement, nfr, story, entity, term | FEAT-, FR-, NFR-, STORY-, ENT-, TERM- |
| (any) | topic | TOP- |
| roadmap | milestone, kpi, goal, plan, timeline | MIL-, KPI-, GOAL-, PLAN-, TL- |
| gtm | positioning, channel, pricing, message | POS-, CHAN-, PRICE-, MSG- |
| (any) | risk, assumption, question | RISK-, ASMP-, Q- |
| decisions | decision (MADR) | DEC- |
| sources | source (evidence) | SRC- |

## Skills — when to use
| Situation | Skill |
|---|---|
| start of session | `kb-orient` |
| gather knowledge / resolve gaps (clarify loop) | `kb-elicit` |
| write one note | `kb-capture` |
| answer from the KB | `kb-recall` |
| rename / deprecate / merge / split / retype | `kb-evolve` (check `npm run impact -- <ID>` first) |
| clear deprecated-link debt in bulk | `kb-sanitize` |
| goals (GOAL-) | `kb-goal` |
| operational plan (PLAN-001) — never kb:write | `kb-plan` |
| dashboard / map | `kb-dashboard`, `kb-visualize` |
| "what changed …" | `kb-recap` |

## Persistence
A UserPromptSubmit hook watches uncommitted `knowledge/` changes; per
`kb.config.yml` `persistence.autocommit` it stays silent (`off`), nudges
(`manual`) or tells you to commit (`auto`). When asked, commit `knowledge/` +
`index/` with a message saying what changed. `mode` (tone) and `autocommit` are
independent.

## Tooling
- `npm run kb:write` — write notes (JSON on stdin `[{domainDir, frontmatter,
  body}]`; prints assigned ids).
- `npm run validate` · `npm run reindex` · `npm run graph` — also run by hooks
  (PostToolUse / Stop / pre-commit; `npm run install-hooks` installs the latter).
- `npm run query -- <name> [--param X]` — saved frontmatter queries (`queries/*.yml`,
  format in `lib/query.mjs`); `--list` shows them.
- `npm run clarify` · `npm run impact -- <ID>` · `npm run plan -- <verb>` ·
  `npm run dashboard` (http://localhost:4321, read-only) · `npm test`.
- `lib/` pure modules, `tools/` CLIs + schemas, `test/` suite; `docs/superpowers/`
  is engine design history (not product knowledge).

## Mode
`debug` (default) — report reads/writes/changes explicitly. `autonomous` — short
human acknowledgements; hide wiki mechanics.
