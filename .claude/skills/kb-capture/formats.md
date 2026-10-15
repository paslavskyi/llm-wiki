# Note formats — reference

Read the section for the note type you are about to write or change. Everything
here is enforced by `validate` + the write pipeline unless marked *(health)* —
those are reported in `index/health.md` / `index/coverage.md`, not blocked.

## Common frontmatter
`id, type, title, status (draft|proposed|accepted|deprecated), summary` are
required; plus `tags`, `links` (plain "see also"), `topic: TOP-…`, `sources`,
`relations`, `superseded_by`. `created`/`updated` are set by the pipeline.
- `topic` and `risk`/`assumption`/`question` may sit in any domain folder; every
  other type only in its own (`lib/vocabulary.mjs`).
- Uncertainty in a body: `[NEEDS CLARIFICATION: …]` / `[ASSUMPTION: …]` — a note
  cannot be `accepted` while any remain (`lib/markers.mjs`).

## Typed relations — `relations: { <name>: [ids] }`
Declared once, on the owning note; inverses are derived into
`index/relations.json`. Allowed pairs (`lib/relations.mjs`):

| relation | from | to | inverse |
|---|---|---|---|
| refines | feature/requirement/nfr/story | feature/requirement/nfr/jtbd/goal | refined_by |
| addresses | feature/requirement/nfr/story/value-prop/decision | pain/jtbd | addressed_by |
| serves | feature/requirement/nfr/story/value-prop/positioning/message/channel/pricing | persona/segment | served_by |
| mitigates | feature/requirement/nfr/story/decision/milestone | risk | mitigated_by |
| measures | kpi | goal/milestone/vision/value-prop/feature/requirement/nfr/story | measured_by |
| answers | any | question | answered_by |
| depends_on | any | any (acyclic) | required_by |
| conflicts_with | any | any | conflicts_with |

## Evidence — `source` (SRC-, folder `sources`)
Required `kind`: interview | conversation | document | url | research | survey |
analytics | observation; optional `origin` (who/where/when). Body = the verbatim
quote/excerpt, never a paraphrase. Any note cites it via `sources: [SRC-…]`.
*(health)* accepted persona/segment/jtbd/pain/competitor/market-insight without
`sources`; sources nothing cites.

## Requirements & stories — FR-, NFR-, STORY-
- `requirement`/`nfr`: required `priority` (must|should|could|wont) and
  `category` (functional|non-functional).
- `acceptance: [{id, text, verify?}]` (requirement/nfr/story). `text` is EARS
  (`WHEN <trigger> THE SYSTEM SHALL <response>`; uk `КОЛИ … СИСТЕМА ПОВИННА …`)
  or Given/When/Then (uk ДАНО/КОЛИ/ТОДІ). Plain strings are fine — the pipeline
  assigns `<ID>.<n>` and never renumbers. Cite one criterion as `FR-012.1`
  (links/relations/`[[FR-012.1]]`; must exist).
- *(health)* criteria in neither form; quality words (fast, secure, зручно…)
  with no number. *(coverage)* must-requirements/stories without criteria.

## Assumptions — ASMP-
`validation: open | validated | invalidated` (assumption only). `status` = how
settled the note is; `validation` = whether reality confirmed it. A verdict must
cite `sources:`; a note with a verdict is no longer "open". *(health)* invalidated
assumptions that live notes still reference.

## Decisions — DEC- (MADR)
Optional `decided`, `revisit` (YYYY-MM-DD), `deciders` / `consulted` / `informed`.
Body sections in order: `## Context`, `## Considered Options`, `## Decision`,
`## Consequences`, `## Confirmation` (uk: Контекст / Розглянуті варіанти /
Рішення / Наслідки / Підтвердження). Accepted ⇒ Context, Decision, Consequences
required. A changed decision records the supersession in its body; the live note
states the current verdict. *(health)* missing Options/Confirmation; `revisit`
date passed.

## Mind-map — TOP-
`parent: TOP-… | null` (null = top-level area). Concrete notes attach via
`topic: TOP-…`. Both must resolve to a topic note.

## Goals, plan, timeline — GOAL-, PLAN-001, MIL-, TL-001
- `goal`: `scope: [ids]`; progress is computed from scope statuses, never stored.
  Edit only via `kb-goal`.
- `plan` (singleton PLAN-001): `active`, `queue` (order = execution sequence),
  `backlog`; disjoint, live ids. done is derived from git history. Item
  dependencies = `relations.depends_on` on the items. Change ONLY via `kb-plan`
  → `npm run plan -- <verb>`, never kb:write.
- `milestone`: `proposed` = planned, `accepted` = reached; optional `due`.
  `timeline` (singleton TL-001): `sequence: [MIL-…]`. Product states and «we are
  here» are derived, never stored.
