---
name: kb-capture
description: Use to record a single piece of product knowledge as an atomic note in this repo — resolves whether to create new or update existing, assigns a stable id, writes valid frontmatter, and links it into the graph.
---

# kb-capture — write one atomic note

Goal: capture exactly one concept correctly, without creating duplicates.

## Step 1 — RESOLVE (always first)
Before writing, use the `kb-recall` skill to check whether this concept already exists:
- Same concept already noted → **update** that note.
- Related but distinct → **create** a new note and add a `links` entry to the related one.
- Nothing found → **create** a new note.
If the update would ripple to other notes (their meaning depends on this change),
stop and hand off to `kb-evolve`.

### Recurring-concern check (avoid duplicating a thought across note bodies)
`resolve` above catches duplicate NOTES. This catches a duplicate THOUGHT — the
same risk / assumption / trade-off / caveat re-stated inside the bodies of several
otherwise-different notes (the dup-detection heuristic can't see this, because the
titles differ).

Before writing a risk / assumption / trade-off / caveat into a note body, ask:
"Have I already stated this same concern elsewhere?"
- If it recurs in **≥2 notes**, it is **cross-cutting**: create ONE canonical note
  for it (`RISK-`/`ASMP-`/`Q-`; `status: accepted` if it's a decided/accepted risk),
  and have the other notes **link** to it instead of restating it. Each note's body
  then describes only what is *specific to it*; the shared concern lives in the canon.
- Threshold matters (avoid over-splitting): only canonicalize a concern that genuinely
  repeats as its own unit — not every passing mention of a word. One real second
  occurrence is the trigger.
- If the duplication already exists across notes, canonicalize + relink (use
  `kb-evolve` to replace inline restatements with a link).

## Step 2 — IDENTIFY
- Pick the `type` from the vocabulary in `CLAUDE.md`.
- Choose the matching domain folder (`topic` and `risk`/`assumption`/`question`
  may sit in any domain; every other type has exactly one — `lib/vocabulary.mjs`).
- For a NEW note, omit `id`: the write pipeline assigns the next free one for the
  type's prefix (`npm run kb:write` prints it, e.g. `created FR-007`). For an
  update, pass the existing id. Type, id prefix and folder are enforced — a
  mismatch fails the write and `validate`.

## Step 3 — WRITE (through the write pipeline)
- Filename target: `knowledge/<domain>/<ID>-<slug>.md` (slug = kebab of title; the
  write pipeline derives it).
- Build the note "intent" (frontmatter required fields: `type, title, status,
  summary` (+ `id` when updating) + `priority, category` for requirement/nfr; `parent` for topic; plus
  `links`, body). Status of a NEW note reflects how settled the knowledge is:
  `draft` = tentative/unconfirmed; `proposed` = awaiting the owner's verdict;
  `accepted` = the owner confirmed/decided it in this dialogue (approved
  decisions, goals, reached stages). Don't default to `draft` for owner-approved facts.
- Write via the atomic write pipeline — `npm run kb:write` (JSON on stdin, wraps
  `tools/write-note.mjs`; NOT a raw Write):
  it reconstructs the note to a healthy state (rule_set: sets `updated`, preserves
  `created`, resolves any deprecated refs to live ids, dedupes links, removes
  self-refs, keeps unknown fields verbatim) and writes atomically.
- Do NOT hand-edit `index/`.

## Step 4 — VERIFY
- The PostToolUse hook runs `node tools/validate.mjs` automatically. If it reports
  an error, fix the note until validation passes.
- Update `STATE.md` ONLY for non-derivable intent (current focus / next step). NEVER put note counts,
  per-domain progress, or open-question lists there — those are generated in `index/MAP.md` +
  `index/health.md` (an open question is captured as a `Q-` note, which health.md surfaces). Copying
  derived facts into STATE is what makes it drift. (See CLAUDE.md → "STATE.md scope".)

## Output (per mode)
- `debug`: state which note you created/updated, its id, and links added.
- `autonomous`: a short human acknowledgement (e.g., "Занотував.").

## Rules
- One concept per note. If you're writing two ideas, make two notes.
- Never reuse or delete an id. To retire a note, deprecate it (`kb-evolve`).
- Never hand-edit `index/`.
