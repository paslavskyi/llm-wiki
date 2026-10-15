// Typed relations between notes: `relations: { <name>: [ids] }` in frontmatter.
// Each relation declares which note types it may start from / point to
// (null = any) and the name of its inverse, which is DERIVED into
// index/relations.json — declare an edge once, on the note that "owns" it.
// Untyped `links:` stays for plain "see also" references.

const WORK = ['feature', 'requirement', 'nfr', 'story'];

export const RELATIONS = {
  refines:        { inverse: 'refined_by',     from: WORK, to: ['feature', 'requirement', 'nfr', 'jtbd', 'goal'] },
  addresses:      { inverse: 'addressed_by',   from: [...WORK, 'value-prop', 'decision'], to: ['pain', 'jtbd'] },
  serves:         { inverse: 'served_by',      from: [...WORK, 'value-prop', 'positioning', 'message', 'channel', 'pricing'], to: ['persona', 'segment'] },
  mitigates:      { inverse: 'mitigated_by',   from: [...WORK, 'decision', 'milestone'], to: ['risk'] },
  measures:       { inverse: 'measured_by',    from: ['kpi'], to: ['goal', 'milestone', 'vision', 'value-prop', ...WORK] },
  answers:        { inverse: 'answered_by',    from: null, to: ['question'] },
  depends_on:     { inverse: 'required_by',    from: null, to: null },
  conflicts_with: { inverse: 'conflicts_with', from: null, to: null },
};

export function relationTargets(fm) {
  const rel = fm?.relations;
  if (!rel || typeof rel !== 'object') return [];
  return Object.values(rel).flatMap(v => (Array.isArray(v) ? v.map(String) : []));
}

// checkRelations: errors (strings, without the id) for a note's relations.
// typeById: Map id → type. Missing targets are left to the dangling-link check.
export function checkRelations(fm, typeById) {
  const rel = fm.relations;
  if (rel === undefined || rel === null) return [];
  if (typeof rel !== 'object' || Array.isArray(rel)) return ['relations must be a map { relation: [ids] }'];
  const errors = [];
  for (const [name, targets] of Object.entries(rel)) {
    const def = RELATIONS[name];
    if (!def) {
      errors.push(`unknown relation "${name}" (known: ${Object.keys(RELATIONS).join(', ')})`);
      continue;
    }
    if (!Array.isArray(targets)) {
      errors.push(`relation "${name}" must be a list of ids`);
      continue;
    }
    if (def.from && !def.from.includes(fm.type)) {
      errors.push(`relation "${name}" cannot start from a ${fm.type} (allowed: ${def.from.join(', ')})`);
      continue;
    }
    for (const t of targets) {
      const tt = typeById.get(t);
      if (tt && def.to && !def.to.includes(tt)) {
        errors.push(`${name} → ${t}: target must be ${def.to.join('/')}, not ${tt}`);
      }
    }
  }
  return errors;
}

// relationEdges: { id: { relation | inverse: [ids] } } over all notes, sorted.
export function relationEdges(notes) {
  const out = {};
  const add = (from, name, to) => ((out[from] ??= {})[name] ??= new Set()).add(to);
  for (const n of notes) {
    const { id, relations } = n.frontmatter;
    if (!id || !relations || typeof relations !== 'object') continue;
    for (const [name, targets] of Object.entries(relations)) {
      const def = RELATIONS[name];
      if (!def || !Array.isArray(targets)) continue;
      for (const t of targets) {
        add(id, name, String(t));
        add(String(t), def.inverse, id);
      }
    }
  }
  const sorted = {};
  for (const id of Object.keys(out).sort()) {
    sorted[id] = Object.fromEntries(Object.entries(out[id]).map(([k, s]) => [k, [...s].sort()]));
  }
  return sorted;
}

// dependencyCycles: every depends_on cycle once, rotated to start at its
// smallest id (deterministic). Unknown targets are ignored.
export function dependencyCycles(notes) {
  const graph = new Map();
  for (const n of notes) {
    const deps = n.frontmatter?.relations?.depends_on;
    graph.set(n.frontmatter.id, Array.isArray(deps) ? deps.map(String) : []);
  }
  const cycles = new Map();
  const state = new Map(); // id → 'visiting' | 'done'
  const stack = [];
  const visit = (id) => {
    state.set(id, 'visiting');
    stack.push(id);
    for (const d of graph.get(id) ?? []) {
      if (!graph.has(d)) continue;
      if (state.get(d) === 'visiting') {
        const cyc = stack.slice(stack.indexOf(d));
        const start = cyc.indexOf([...cyc].sort()[0]);
        const canon = [...cyc.slice(start), ...cyc.slice(0, start)];
        cycles.set(canon.join('>'), canon);
      } else if (!state.has(d)) visit(d);
    }
    stack.pop();
    state.set(id, 'done');
  };
  for (const id of [...graph.keys()].sort()) if (!state.has(id)) visit(id);
  return [...cycles.values()].sort((a, b) => a[0].localeCompare(b[0]));
}
