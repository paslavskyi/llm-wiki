---
name: kb-recall
description: Use to find existing product knowledge in this repo before answering, deciding, or capturing — navigates index-first (MAP → domain index → specific notes) instead of reading everything.
---

# kb-recall — index-first retrieval

Goal: find the relevant notes for a question while reading as little as possible.

## Steps
1. Read `index/MAP.md` to pick the relevant domain(s) by note counts and names.
2. Open the relevant `index/<domain>.index.md`. Use the `summary` column to
   shortlist candidate ids — do NOT open notes yet.
3. Open only the shortlisted note files.
4. Follow `links` (and `index/backlinks.json` for reverse links) to pull in
   directly related notes — one hop unless the question needs more.
5. Report findings:
   - `debug`: list the ids you read and their statuses.
   - `autonomous`: summarize what's already known in plain language, no ids.

## Rules
- Never read the whole `knowledge/` tree. If the index can't answer it, widen the
  shortlist by one hop at a time.
- Recall is read-only. To write, hand off to `kb-capture`.
