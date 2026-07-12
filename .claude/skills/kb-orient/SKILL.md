---
name: kb-orient
description: Use at the start of every session in this knowledge repo to learn where we are and what's next, before any other work. Reads STATE and the index map, never the whole repo.
---

# kb-orient — session bootstrap

Goal: in seconds, know the current phase, what's done, what's next, and open
questions — without loading the whole knowledge base.

## Steps
1. Read `kb.config.yml`. Note `mode` and `language`. Respond in `language`.
   - `debug`: report what you read and the full picture.
   - `autonomous`: give only a short human summary of where things stand.
2. Read `STATE.md` — current focus + next step (intent ONLY; it does not hold counts/progress).
3. Read `index/MAP.md` — domains and note counts. Do NOT open individual notes yet. This is the
   AUTHORITATIVE source for counts/progress; if `STATE.md` ever disagrees, MAP/health win.
4. If `index/health.md` exists (Phase 2+), read it for open questions/risks.
5. Run `npm run plan -- show` — the operational plan (в розробці / черга /
   backlog + recent done). This is the delivery half of "where we are"; STATE
   holds only strategic intent. Goals/timeline: `index/roadmap.index.md` if needed.
6. Produce an orientation summary:
   - Current phase and the single recommended next step.
   - Plan snapshot: what's in work, what's next in the queue.
   - Per-domain note counts (from MAP).
   - Any open questions/risks you saw.
   - Offer the live dashboard for visuals (`kb-dashboard` → http://localhost:4321).
7. Hand off: if the next step is knowledge capture, suggest running
   `kb-elicit` or proceed with `kb-capture` for a specific insight.

## Rules
- Never read the whole `knowledge/` tree here. Orientation is index-only.
- Do not modify any file in this skill.
