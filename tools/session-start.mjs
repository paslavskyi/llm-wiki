// SessionStart hook: print a compact, budgeted KB snapshot (stdout becomes
// session context). Gathers inputs; rendering + budget live in
// lib/session-context.mjs. Must never break a session: any failure → silence.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { loadNotes } from '../lib/load-notes.mjs';
import { domainOf } from '../lib/domain.mjs';
import { parseState } from '../lib/dashboard-data.mjs';
import { planReadiness } from '../lib/plan-core.mjs';
import { loadPlanHistory } from '../lib/plan-history.mjs';
import { buildHealth } from './graph.mjs';
import { buildSessionContext } from '../lib/session-context.mjs';

const root = process.cwd();
try {
  const config = await loadConfig(root);
  let state = {};
  try { state = parseState(await readFile(join(root, 'STATE.md'), 'utf8')); } catch { /* optional */ }

  const notes = (await loadNotes(root)).filter(n => n.frontmatter.id && n.frontmatter.status !== 'deprecated');
  const domains = {};
  for (const n of notes) { const d = domainOf(n.filePath); domains[d] = (domains[d] ?? 0) + 1; }

  let plan = null;
  const planNote = notes.find(n => n.frontmatter.type === 'plan');
  if (planNote) {
    const fm = planNote.frontmatter;
    let doneIds = new Set();
    try { doneIds = new Set((await loadPlanHistory(root)).done.map(e => e.id)); } catch { /* no git */ }
    plan = { active: fm.active ?? [], next: planReadiness(fm.queue ?? [], notes, doneIds).next, queued: (fm.queue ?? []).length };
  }

  const { markdown: healthMd } = await buildHealth(root);
  console.log(buildSessionContext({
    config, state: { focus: state.focus, next: state.next }, domains, plan, healthMd,
    budget: config.session.budget_bytes,
  }));
} catch {
  // never disrupt session start
}
