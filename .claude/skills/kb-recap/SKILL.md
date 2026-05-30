---
name: kb-recap
description: Use on request to summarize what changed in the knowledge base over a time range or area ("what did we do today", "what changed about users") — a read-only narrative from git history. Saves nothing.
---

# kb-recap — optional, read-only history recap

Goal: answer a user's question about recent changes with a narrative built from
git facts. Persistence is automatic and separate — recap never saves anything.

## Steps
1. Parse the requested range from the user:
   - time: "today" / "this week" → `--since "<date>"`
   - area: "about users" / a domain → `--area <folder>`
   - "since last commit" → `--ref <ref>`
2. Run `node tools/session-delta.mjs` with those flags → facts
   (added / updated / deleted notes under knowledge/, optionally area-filtered).
3. For richer narrative, you MAY read a few of the changed notes' summaries via
   `kb-recall` (index-first) — do not read the whole tree.
4. Write the narrative: what was added, changed, deprecated, and any new open
   questions in that range.
   - `debug`: include ids.
   - `autonomous`: plain language, no ids/mechanics.
5. If the range is empty: "No changes in that period."

## Rules
- Read-only. Never write notes, never commit, never create a journal file.
- Index-first if you open anything; never read the whole knowledge tree.
