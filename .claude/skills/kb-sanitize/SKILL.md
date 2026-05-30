---
name: kb-sanitize
description: Use on request to clear accumulated migration debt — rewrite all references to deprecated notes onto their live superseding ids — in one isolated bulk commit, separate from logical changes.
---

# kb-sanitize — bulk debt migration

Goal: collect the migration debt (references still pointing at deprecated notes)
and resolve it in a single, isolated commit — keeping technical churn out of
logical-change commits.

## Steps
1. Read `index/health.md` (Tier-1 "migration debt") and/or scan notes for any
   `links` / `parent` / `topic` pointing at a `status: deprecated` note.
2. For each source note with debt, rewrite it through the write pipeline
   (`tools/write-note.mjs`). The heal rule_set resolves each reference to the
   LIVE head of the `superseded_by` chain (transitively, cycle-guarded), dedupes
   links, and removes self-references — automatically.
3. After all rewrites, run `npm run reindex` and `npm run graph` so indexes and
   `health.md` reflect zero (or reduced) debt.
4. Commit everything as ONE bulk commit:
   `chore(sanitize): migrate N deprecated references`.

## Rules
- This is the ONLY place bulk reference rewrites across many notes are allowed.
  Logical changes never do bulk ripple (that stays passive / per-note).
- Manual / on-request only (future: scheduled). Never auto-runs.
- All writes via the write pipeline; never hand-edit notes or `index/`.

## Output (per mode)
- `debug`: list each note rewritten and each reference migrated (old → live id).
- `autonomous`: short acknowledgement ("Прибрав технічний борг.").
