---
name: kb-plan
description: Use when the owner talks about the operational development plan in dialogue — "зараз робимо X", "потім Y", "відклади Z у backlog", "піднімай W з backlog", "X зроблено", "покажи план/чергу". Translates natural language into deterministic tools/plan.mjs commands; never edits the plan YAML by hand.
---

# kb-plan — dialogue-driven operational planning

Goal: turn planning statements into deterministic plan operations. The mechanics
live in `tools/plan.mjs`; this skill ONLY translates language → commands.

## Model
- `PLAN-001` (singleton, type `plan`): `active` (в розробці), `queue` (TODO,
  ORDER = execution sequence), `backlog` (parked).
- **done is never stored** — it is derived from the plan note's git history.
  That is why every operation makes its own commit with a canonical message.
- Goals (`GOAL-`) are independent of the plan; a plan item may be any live note
  id (MIL/FEAT/FR/RISK/Q/GOAL/...).

## Verb mapping (run via `npm run plan -- <verb> ...`)
| Owner says | Command |
|---|---|
| «зараз робимо X, потім Y, Z» | `set --active X --queue Y,Z` (confirm what happens to items currently in lists but not mentioned — done/drop/backlog?) |
| «беремо X в роботу» / «беремо наступну» | `take X` / `take` |
| «X зроблено / готово» | `done X` |
| «X більше не актуально, прибери» | `drop X` (NOT done — history distinguishes by message) |
| «відклади X у backlog / колись повернемось» | `defer X` |
| «піднімай X з backlog» | `promote X [--pos N]` (ask position if unclear; default = end of queue) |
| «X перед Y / підніми X вище» | `move X --pos N` |
| «покажи план / чергу / що в роботі» | `show` |

## Rules
- NEVER edit the plan note with Write/Edit or kb:write — only `tools/plan.mjs`
  (it heals, validates disjointness, reindexes, and commits atomically; the
  commit message is load-bearing for done-history).
- Resolve titles to ids first (kb-recall / indexes). If the owner names work
  that has no note yet, capture it first (kb-capture), then plan it.
- On «X зроблено» where X is a goal or has a scope: check scope completion
  (`npm run impact -- X`, note statuses) and surface unfinished tails instead of
  silently closing.
- Ambiguity (position in queue, what to do with unmentioned items in `set`) →
  ask, don't guess.
- After every operation: show the resulting lists (the CLI prints them) so the
  owner immediately verifies the plan matches what they said.

## Output (per mode)
- `debug`: command(s) run + resulting lists.
- `autonomous`: short confirmation + resulting queue.
