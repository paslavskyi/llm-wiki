---
name: kb-elicit
description: Use to run a structured knowledge-gathering dialogue in this repo — collaboratively frame the mind-map of areas, then drill top-down, turning the conversation into atomic notes. Reusable across knowledge bases via kb.framework.yml.
---

# kb-elicit — dialogue engine (mind-map)

Goal: turn a conversation into a well-structured knowledge graph, top-down,
saving each note only once it is a logically consistent, complete thought.

## Method

### Stage 0 — frame the map (when the map is empty, or on request)
1. Read `kb.config.yml` (mode, language) and run `kb-orient`. Check whether a map
   exists (any `type: topic` notes / `index/mindmap.md`).
2. Read `kb.framework.yml`. Propose its `areas` as a recommended top-level
   skeleton — explicitly a starting point, not a mandate.
3. Adapt WITH the user: add / rename / drop areas to fit this base.
4. For each agreed top-level area, create a `topic` note (`parent: null`) via
   `kb-capture`, placed in `knowledge/<key>/`. Use the area's `framing` questions
   to seed the conversation.
5. Update `STATE.md`: map framed; recommended next area. (Intent only — never copy counts/progress;
   those are generated in `index/`. See CLAUDE.md → "STATE.md scope".)

### Stage 1 — drill top-down (when a map exists)
1. Present the agenda (see "Coverage / agenda" below) and propose where to dive.
   Agree on a node with the user.
2. Frame the node: propose "what's worth collecting here" (sub-aspects). Capture
   agreed sub-aspects as child `topic` notes (`parent: <node>`). A node's
   skeleton lives as prose in its body + child topics — there is no rigid
   checklist field (LLM-native: structure is the graph + prose).
3. Fill each sub-aspect: converse, asking clarifying questions, UNTIL the note is
   logically consistent (a complete, coherent thought). Only then save it via
   `kb-capture` with `topic: <node>`.
4. Anything unresolved becomes a note, not a dropped thread: open question -> `Q-`,
   assumption -> `ASMP-`, risk -> `RISK-`, attached to the same node.
5. On request, propose options or research (web/evidence) and fold conclusions
   back into notes (cite sources for research).
6. Update `STATE.md` (current focus, next step — intent only; no counts/progress, see "STATE.md scope").

## Saving rule
Save when a note is logically consistent. Ask a clarifying question instead of
saving a half-formed note. Confirm with the user only when a write OVERWRITES
existing knowledge; new, consistent knowledge is captured as it forms.

Recurring concern? If the same risk/assumption/trade-off recurs across ≥2 notes,
canonicalize it into ONE note and link the others to it — don't re-state the same
thought in multiple bodies (see kb-capture "Recurring-concern check").

## Coverage / agenda (what to work on next)
Compose, do not maintain a separate drifting artifact:
1. Empty areas — from `index/MAP.md` (count 0).
2. Open `Q-` / `ASMP-` / `RISK-` notes — known gaps.
3. Topic nodes with no attached notes — from `index/mindmap.md`.

## Output (per mode)
- `debug`: state which notes you created/updated, their ids, and the agenda.
- `autonomous`: short human acknowledgements; hide ids and wiki mechanics.

## Rules
- Capture only via `kb-capture`; resolve-before-write to avoid duplicates.
- Never edit `index/` by hand. After writes, the Stop hook reindexes.
- One concept per note. Keep `topic`/`parent` pointing at real `TOP-` notes.
- Suggest running `kb-visualize` when the user wants to see the map.
