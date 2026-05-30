---
name: kb-evolve
description: Use to change existing knowledge safely — rename, deprecate, merge, or split notes — without breaking the graph. Computes blast radius first; never reuses or deletes an id (tombstone via superseded_by).
---

# kb-evolve — safe evolution of notes

Goal: change already-captured knowledge without breaking links or violating the
stable-id invariant.

## Before any change with ripple
Run `node tools/impact.mjs <ID>` (optionally `--depth N`) and show the blast
radius (who links to this note, what it links to). Decide WITH the user.

## Operations

### rename-in-place — SAME id prefix (cosmetic)
The change stays within the same category (better slug / title / wording). Keep
the `id`; update title (and thus filename) by writing through the write pipeline
(`tools/write-note.mjs`). Backlinks untouched (they point at the id).

### tombstone migration — DIFFERENT id prefix (meaning changed)
`AB-123` should become `CD-xxx` (e.g. a requirement was really an NFR):
1. Create the new note with a fresh id via the write pipeline.
2. Mark the old note `status: deprecated` + `superseded_by: CD-xxx` (write pipeline).
3. Do NOT mass-rewrite backlinks. They remain valid (validate allows links to a
   deprecated note) and surface as Tier-1 "migration debt" in `index/health.md`.
   Debt heals passively (each note's next write reconstructs it to the live id)
   or in bulk via `kb-sanitize`.

### deprecate
Set `status: deprecated` (+ `superseded_by` if there is a successor) via the
write pipeline.

### merge
N notes → one target. The others become `deprecated` + `superseded_by: <target>`.
Move any unique content into the target first.

### split
One note → several. Original becomes `deprecated` + `superseded_by` (to the main
heir) OR is repurposed as an umbrella `topic` (judgment call). New notes get fresh ids.

## Invariants
- Never reuse or delete an id. Retire via `deprecated` + `superseded_by` (tombstone).
- All writes go through the write pipeline (`tools/write-note.mjs`) so the rule_set
  (heal) and atomic write apply. Never hand-edit notes for evolution.
- Never hand-edit `index/`. After writes, the Stop hook reindexes; `graph.mjs`
  refreshes `health.md` (or run `npm run graph`).

## Output (per mode)
- `debug`: show the blast radius, which notes changed, ids, and the resulting debt.
- `autonomous`: short human acknowledgement; hide ids/mechanics.
