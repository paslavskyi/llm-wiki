---
name: kb-goal
description: Use when the owner creates or edits a product Goal in dialogue — "створи Goal «...» — він включає ...", "додай до цілі ...", "покажи ціль ...". Creates the GOAL- note, discovers existing notes for its scope via recall, elicits/researches and captures new notes, and reports composition. Goals are independent of the operational plan (kb-plan).
---

# kb-goal — create and maintain product goals

Goal: a `goal` note (GOAL-, domain roadmap) = назва + опис + `scope` (ids of
member notes). Progress is COMPUTED (share of scope with status `accepted`) —
never stored. Goals are orthogonal to PLAN-001: scope items may sit
in the plan's queue, backlog, or nowhere.

## Flow for «Створи Goal "..." — він включає <ідеї/пункти>»
1. **Create the note** via kb-capture conventions (omit `id` — the pipeline
   assigns the next GOAL-; type `goal`; domain `roadmap`; `scope: []`; topic —
   the roadmap area's TOP- node, if the map has one; write through
   `npm run kb:write`).
2. **Discover existing knowledge**: use kb-recall (MAP → domain indexes →
   notes) for each idea the owner listed. Report what was found and WHY it
   belongs; add confident matches to `scope`, ask about doubtful ones.
3. **Formulate the new**: for each idea with no note — analyze; ask clarifying
   questions where the intent is ambiguous; research (web / deep-research) if
   knowledge is missing; then capture new notes of the correct types
   (FEAT/FR/STORY/Q/RISK/...) via kb-capture and add their ids to `scope`.
4. **Report composition**: goal id, scope list (found vs newly created),
   computed progress, and whether any scope items are already in PLAN-001
   (queue/backlog) — without implying the goal itself is planned.

## Editing an existing goal
- «додай X до цілі» / «прибери X» → update the goal note's `scope` through the
  write pipeline (`npm run kb:write` with full note content). The pipeline
  heals: dedupe, deprecated→live resolution, no self-refs; validate gates
  dangling ids.
- Never mark progress by hand — it is derived. A goal is "done" when all scope
  is accepted; celebrate it, don't store it.

## Rules
- One goal = one theme. Two unrelated themes in one request → two goals.
- scope items must be live notes; capture before adding.
- Do not touch PLAN-001 here — planning is kb-plan's job. If the owner says
  «і бери в роботу» — finish the goal, then invoke kb-plan.
