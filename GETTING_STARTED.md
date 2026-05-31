# Getting Started with LLM_Wiki

LLM_Wiki is a **GitHub template** for building an LLM-native, session-free
knowledge base. You talk to an AI assistant in plain language; it captures your
knowledge as small, interlinked, machine-validated notes and keeps everything
tidy. It ships empty on purpose — you fork it and fill it with *your* domain
(a product, a research area, a course, a company handbook…).

> Already set up? See **[README](README.md)** for how to use it day-to-day.

---

## Contents
1. [What you get](#what-you-get)
2. [Requirements](#requirements)
3. [Create your knowledge base from this template](#create-your-knowledge-base-from-this-template)
4. [First-time setup](#first-time-setup)
5. [Your first session](#your-first-session)
6. [How it's organized](#how-its-organized)
7. [Adapting it to a non-product domain](#adapting-it-to-a-non-product-domain)
8. [Troubleshooting](#troubleshooting)

---

## What you get

- **8 AI skills** that drive the whole workflow: orient, capture, recall, elicit
  (dialogue engine), visualize (graphical mind-map), evolve, sanitize, recap.
- A **deterministic write pipeline** — every note is auto-validated, healed to a
  healthy state, and atomically saved (no corrupted files, stable IDs, no broken
  links).
- **Generated indexes** for fast index-first retrieval, a **graphical mind-map**
  (`index/mindmap.html`, fully offline), and a **health report** of gaps/debt.
- **Automatic persistence** — your work is committed for you (configurable).
- It's **self-contained**: all instructions live in the repo, so any new AI
  session continues exactly where the last one left off.

## Requirements

| Requirement | Why | Notes |
|---|---|---|
| **An LLM coding agent** with skills support (e.g. Claude Code) | Runs the 8 skills + hooks | The repo carries `.claude/skills/` and `.claude/settings.json`. |
| **Node.js ≥ 20** (developed on v24) | Validation, indexing, mind-map, persistence tooling | `node --version` |
| **Git** | The knowledge base *is* a git repo; history is the only store | `git --version` |
| A modern **web browser** | View the graphical mind-map | optional |

No database, no server, no cloud. Everything is local Markdown + small Node
scripts.

## Create your knowledge base from this template

**Option A — GitHub UI (recommended):**
1. Click **“Use this template”** → **“Create a new repository”** on the
   [llm-wiki](https://github.com/paslavskyi/llm-wiki) page.
2. Name your repo, choose visibility, create it.
3. Clone your new repo locally.

**Option B — GitHub CLI:**
```bash
gh repo create my-knowledge-base --template paslavskyi/llm-wiki --private --clone
cd my-knowledge-base
```

## First-time setup

```bash
# 1. Install tooling dependencies
npm install

# 2. Install the git pre-commit guard (validate + reindex + health)
npm run install-hooks

# 3. Sanity-check the toolchain
npm test            # all tests should pass
npm run validate    # "✓ knowledge base valid" on the empty base
```

Then make it yours by editing **`kb.config.yml`**:

```yaml
mode: debug          # debug = verbose; autonomous = short, human-friendly
language: uk         # your preferred response language (e.g. en, uk, ...)
owner: Your Name

persistence:
  autocommit: manual # off | manual | auto  (how saving happens)
```

> `mode` (tone) and `persistence.autocommit` (saving) are independent. A
> non-technical user typically wants `mode: autonomous` + `autocommit: auto`.

## Your first session

Open the repo with your LLM agent and just talk to it:

1. **“orient”** — it reports where things stand (empty base, ready to start).
2. **“let's capture knowledge”** — it co-designs the *map of areas* with you
   (Stage 0), then drills top-down, turning the conversation into notes.
3. **“show the map”** — it generates the interactive mind-map and tells you how
   to open it.

That's it. You don't manage files, IDs, or indexes — the system does.
See the [README command cheat-sheet](README.md#8-command-cheat-sheet) for more.

## How it's organized

```
knowledge/      # YOUR notes (the source of truth) — starts empty
index/          # GENERATED routing layer (MAP, per-domain, backlinks, mindmap, health)
kb.config.yml   # runtime config (mode, language, persistence)
kb.framework.yml# seed: recommended top-level areas + framing questions (editable)
.claude/        # the AI assistant: skills + hooks (the "how")
lib/ tools/     # Node engine: validation, indexing, write pipeline, mind-map
test/           # the tooling test suite
docs/           # design specs & implementation plans (the "why", for the curious)
```

**Invariants worth knowing:** never hand-edit `index/`; notes are written only
through the assistant (so they stay valid); IDs are stable and never reused.
Full rules live in [`CLAUDE.md`](CLAUDE.md).

## Adapting it to a non-product domain

The default seed (`kb.framework.yml`) is product-oriented (vision, users,
product, market, roadmap, gtm). To repurpose:

1. Edit **`kb.framework.yml`** — replace the `areas` with your own top-level
   sections and their framing questions (e.g. for research: *background,
   methods, findings, open problems*).
2. Optionally adjust the ID vocabulary table in **`CLAUDE.md`** if your domain
   needs different note types.
3. Start a session and say *“let's frame the map”* — the assistant will propose
   your seed and adapt it with you.

Everything else (validation, indexing, mind-map, persistence) is domain-agnostic
and just works.

## Troubleshooting

- **`npm test` fails** → confirm Node ≥ 20 (`node --version`); run `npm install`.
- **Pre-commit hook not running** → re-run `npm run install-hooks`.
- **Mind-map is blank in the browser** → regenerate with `npm run mindmap` and
  reopen `index/mindmap.html`; it's offline (vendored d3 + markmap).
- **The assistant edited `index/` by hand** → it shouldn't; regenerate with
  `npm run reindex`. Report it as a bug if it recurs.
- **Windows line-endings noise** → `.gitattributes` enforces LF; let git handle it.
