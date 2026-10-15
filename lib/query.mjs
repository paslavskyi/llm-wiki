// Saved queries over note frontmatter (after Obsidian Bases / Dataview): a small
// declarative YAML spec that the CLI (`npm run query`), the dashboard and the
// LLM all run the same way — "every must-requirement without criteria" becomes
// one query instead of a manual walk.
//
//   title: Features serving a persona        # required
//   from: [feature]                          # types (optional; default all)
//   where:                                   # all conditions must hold
//     - relations.serves: { has: $param }    # dotted paths reach nested fields
//     - status: { not: draft }
//   sort: -updated                           # field; "-" = descending
//   show: [id, title, status]                # columns (default id, type, title, status)
//   limit: 50
//   include_deprecated: false                # default false
//
// Operators: plain value (equality), in, not, empty, has, lt, lte, gt, gte,
// missing; and the pseudo-field `refs: <id>` (the note references that id
// anywhere — links, sources, relations, scope, body [[…]]).
import { VOCABULARY } from './vocabulary.mjs';

const KEYS = new Set(['title', 'description', 'from', 'where', 'sort', 'show', 'limit', 'include_deprecated']);
const OPS = new Set(['in', 'not', 'empty', 'has', 'lt', 'lte', 'gt', 'gte', 'missing']);
const DEFAULT_SHOW = ['id', 'type', 'title', 'status'];

const get = (obj, path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), obj);
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length)
  || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
const usesParam = (spec) => JSON.stringify(spec?.where ?? []).includes('$param');

// checkQuery(spec, params) → errors[]
export function checkQuery(spec, params = {}) {
  const errors = [];
  if (!spec || typeof spec !== 'object') return ['query must be a YAML mapping'];
  for (const k of Object.keys(spec)) if (!KEYS.has(k)) errors.push(`unknown key "${k}"`);
  if (!spec.title) errors.push('title is required');
  for (const t of spec.from ?? []) if (!VOCABULARY[t]) errors.push(`unknown type "${t}" in from`);
  if (spec.where !== undefined && !Array.isArray(spec.where)) errors.push('where must be a list of conditions');
  for (const cond of Array.isArray(spec.where) ? spec.where : []) {
    for (const [, test] of Object.entries(cond ?? {})) {
      if (test && typeof test === 'object' && !Array.isArray(test)) {
        for (const op of Object.keys(test)) if (!OPS.has(op)) errors.push(`unknown operator "${op}"`);
      }
    }
  }
  if (usesParam(spec) && params.param === undefined) errors.push('this query uses $param — it needs --param <value>');
  return errors;
}

function matches(note, field, test, params) {
  const sub = (v) => (v === '$param' ? params.param : v);
  if (field === 'refs') return (note.links ?? []).includes(sub(test));
  const v = get(note.frontmatter, field);
  if (test === null || typeof test !== 'object' || Array.isArray(test)) return v === sub(test);
  return Object.entries(test).every(([op, raw]) => {
    const arg = sub(raw);
    switch (op) {
      case 'in': return Array.isArray(arg) && arg.includes(v ?? null); // absent field matches null
      case 'not': return v !== arg;
      case 'empty': return isEmpty(v) === Boolean(arg);
      case 'missing': return (v === undefined) === Boolean(arg);
      case 'has': return Array.isArray(v) && v.includes(arg);
      case 'lt': return v !== undefined && String(v) < String(arg);
      case 'lte': return v !== undefined && String(v) <= String(arg);
      case 'gt': return v !== undefined && String(v) > String(arg);
      case 'gte': return v !== undefined && String(v) >= String(arg);
      default: return false;
    }
  });
}

// runQuery(spec, notes, params) → rows (objects with the `show` columns).
export function runQuery(spec, notes, params = {}) {
  const from = spec.from?.length ? new Set(spec.from) : null;
  let rows = notes.filter(n => n.frontmatter.id
    && (spec.include_deprecated || n.frontmatter.status !== 'deprecated')
    && (!from || from.has(n.frontmatter.type))
    && (spec.where ?? []).every(cond => Object.entries(cond).every(([f, t]) => matches(n, f, t, params))));

  const sortKey = spec.sort ? String(spec.sort).replace(/^-/, '') : 'id';
  const dir = String(spec.sort ?? '').startsWith('-') ? -1 : 1;
  rows.sort((a, b) => {
    const x = String(get(a.frontmatter, sortKey) ?? '');
    const y = String(get(b.frontmatter, sortKey) ?? '');
    return dir * x.localeCompare(y) || a.frontmatter.id.localeCompare(b.frontmatter.id);
  });
  if (spec.limit) rows = rows.slice(0, spec.limit);
  const show = spec.show?.length ? spec.show : DEFAULT_SHOW;
  return rows.map(n => Object.fromEntries(show.map(c => [c, get(n.frontmatter, c)])));
}
