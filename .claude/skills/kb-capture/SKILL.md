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
stop and hand off to `kb-evolve` (Phase 2). For Phase 1, note the ripple in your
response and update only this note.

## Step 2 — IDENTIFY
- Pick the `type` from the vocabulary in `CLAUDE.md`.
- Choose the matching domain folder and ID prefix.
- Assign the next free id: read `index/<domain>.index.md` (or scan the folder) and
  take the highest existing number for that prefix, +1. Zero-pad to 3 digits
  (e.g., `FR-007`).

## Step 3 — WRITE (through the write pipeline)
- Filename target: `knowledge/<domain>/<ID>-<slug>.md` (slug = kebab of title; the
  write pipeline derives it).
- Build the note "intent" (frontmatter required fields: `id, type, title, status,
  summary` + `priority, category` for requirement/nfr; `parent` for topic; plus
  `links`, body). Set `status: draft` for new notes.
- Write via the atomic write pipeline `tools/write-note.mjs` (NOT a raw Write):
  it reconstructs the note to a healthy state (rule_set: sets `updated`, preserves
  `created`, resolves any deprecated refs to live ids, dedupes links, removes
  self-refs, keeps unknown fields verbatim) and writes atomically.
- Do NOT hand-edit `index/`.

## Step 4 — VERIFY
- The PostToolUse hook runs `node tools/validate.mjs` automatically. If it reports
  an error, fix the note until validation passes.
- Update `STATE.md` if the phase, next step, or an open question changed.

## Output (per mode)
- `debug`: state which note you created/updated, its id, and links added.
- `autonomous`: a short human acknowledgement (e.g., "Занотував.").

## Rules
- One concept per note. If you're writing two ideas, make two notes.
- Never reuse or delete an id. To retire a note, deprecate it (Phase 2 `kb-evolve`).
- Never hand-edit `index/`.
