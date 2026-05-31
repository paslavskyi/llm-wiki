# Contributing to LLM_Wiki

Thanks for your interest! LLM_Wiki is a **template/engine** for LLM-native
knowledge bases. There are two very different kinds of "contribution", and it
helps to be clear which one you mean.

## 1. Improving the engine (this repo)

Bug fixes and features for the tooling, skills, hooks, validation, mind-map,
persistence, docs.

**Ground rules:**
- **TDD.** Every behavior change comes with a test. The suite is `npm test`
  (Node's built-in test runner). Keep it green.
- **No new runtime dependencies** without a strong reason — the engine is
  deliberately tiny (a few well-scoped libs). Vendored browser assets live under
  `tools/vendor/` with provenance recorded.
- **Respect the invariants** (see [`CLAUDE.md`](CLAUDE.md)): never hand-edit
  `index/`; notes are written only through the write pipeline; IDs are stable and
  never reused/deleted (retire via `deprecated` + `superseded_by`).
- **Determinism.** Generators must produce stable, sorted output (clean diffs).
- **Cross-platform.** Developed on Windows + Node v24; keep paths and EOL
  handling portable.

**Workflow:**
```bash
npm install
npm run install-hooks
# make your change with a failing test first
npm test
npm run validate
```
Open a PR using the template; describe the change and how you tested it.

The design history (specs + implementation plans) lives in `docs/superpowers/`
— reading the relevant spec before changing a subsystem will save you time.

## 2. Using the template for your own knowledge base

If you forked this to capture *your* knowledge, you don't contribute back here —
your notes live in *your* repo. But we'd love to hear about it: open a
**Discussion** or an issue with the `showcase` label.

## Reporting bugs / requesting features

Use the issue templates. Good reports include: what you expected, what happened,
your Node version, and steps to reproduce (ideally against the empty template).

## Code of Conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).
