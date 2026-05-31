# STATE — current snapshot

> Read this first (after `kb.config.yml`) at the start of every session, then run the `kb-orient` skill.

## Phase
Phase 2c complete (continuity). Automatic persistence (UserPromptSubmit hook) and the optional read-only `kb-recap` are available. Infrastructure (Phases 1, 2a, 2b, 2c) is complete — ready to capture knowledge.

## Progress by domain
(no knowledge captured yet)

## Next step
Run `kb-elicit` to frame the mind-map (Stage 0) from `kb.framework.yml`, then drill top-down. Use `kb-visualize` to see the graphical map.

## Workflow note
Title changes via write-note create a new slug file but leave the old one (dup-id) — use kb-evolve for rename-in-place, or delete the stale file. Hit once with ASMP-001 (resolved).
Engine hardened (commit 3df6c1f): write-note now does rename-in-place dedup
(title change → old-slug file auto-removed), plus duplicate-frontmatter-key
guards (serialize-time assert + validate check). 127 tests pass.


## Open questions / assumptions / risks
- See `index/health.md` for actionable signals (migration debt, open questions, empty topics). Track open items as `Q-*` / `ASMP-*` / `RISK-*` notes under the relevant domain.
