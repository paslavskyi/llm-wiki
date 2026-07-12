// plan-core: deterministic surgery over the plan note's lists (DEC-032). Pure.
// Lists: active (WIP, unordered), queue (TODO, ORDER = execution sequence),
// backlog (parked). Disjointness holds by construction: every insert first
// removes the id from all lists. "done"/"drop" only remove — completion history
// is derived from the plan note's git history, never stored (no journal).

const LISTS = ['active', 'queue', 'backlog'];

function cloneLists(lists) {
  return {
    active: [...(lists.active ?? [])],
    queue: [...(lists.queue ?? [])],
    backlog: [...(lists.backlog ?? [])],
  };
}

function removeEverywhere(lists, id) {
  let found = false;
  for (const name of LISTS) {
    const i = lists[name].indexOf(id);
    if (i !== -1) { lists[name].splice(i, 1); found = true; }
  }
  return found;
}

// pos: 1-based position in queue; undefined/0 → append.
function insertQueue(lists, id, pos) {
  if (!pos || pos < 1 || pos > lists.queue.length) lists.queue.push(id);
  else lists.queue.splice(pos - 1, 0, id);
}

/**
 * applyPlanOp(lists, op) -> { lists, message }
 * op: { verb, id?, pos?, lists? }
 * message is the canonical commit subject for this operation — plan-history
 * relies on the "plan: drop" prefix to tell dropped from done.
 */
export function applyPlanOp(lists, op) {
  const next = cloneLists(lists);
  const { verb, id, pos } = op;
  const need = (ok, msg) => { if (!ok) throw new Error(`plan ${verb}: ${msg}`); };

  switch (verb) {
    case 'take': { // start working on an item (default: head of queue)
      const target = id ?? next.queue[0];
      need(target, 'queue is empty and no id given');
      removeEverywhere(next, target);
      next.active.push(target);
      return { lists: next, message: `plan: take ${target}` };
    }
    case 'done': { // completed → leaves all lists (history = git)
      need(id, 'id required');
      need(removeEverywhere(next, id), `${id} is not in the plan`);
      return { lists: next, message: `plan: ${id} done` };
    }
    case 'drop': { // removed as a mistake / no longer relevant (NOT completed)
      need(id, 'id required');
      need(removeEverywhere(next, id), `${id} is not in the plan`);
      return { lists: next, message: `plan: drop ${id}` };
    }
    case 'defer': { // park it: anything → backlog (also adds a new id)
      need(id, 'id required');
      removeEverywhere(next, id);
      next.backlog.push(id);
      return { lists: next, message: `plan: defer ${id}` };
    }
    case 'promote': { // into the queue (from backlog or new), at pos or end
      need(id, 'id required');
      removeEverywhere(next, id);
      insertQueue(next, id, pos);
      return { lists: next, message: `plan: promote ${id}${pos ? ` @${pos}` : ''}` };
    }
    case 'move': { // reorder within the queue
      need(id, 'id required');
      need(pos >= 1, 'pos (1-based) required');
      const i = next.queue.indexOf(id);
      need(i !== -1, `${id} is not in the queue`);
      next.queue.splice(i, 1);
      insertQueue(next, id, pos);
      return { lists: next, message: `plan: move ${id} @${pos}` };
    }
    case 'set': { // wholesale replacement ("зараз робимо A, потім B, C")
      const l = op.lists ?? {};
      for (const name of LISTS) {
        need(l[name] === undefined || Array.isArray(l[name]), `${name} must be an array`);
      }
      const replaced = {
        active: [...new Set(l.active ?? next.active)],
        queue: [...new Set(l.queue ?? next.queue)],
        backlog: [...new Set(l.backlog ?? next.backlog)],
      };
      // enforce disjointness: earlier list wins (active > queue > backlog)
      const seen = new Set();
      for (const name of LISTS) {
        replaced[name] = replaced[name].filter(x => !seen.has(x) && (seen.add(x), true));
      }
      return { lists: replaced, message: 'plan: set lists' };
    }
    default:
      throw new Error(`plan: unknown verb "${verb}"`);
  }
}

export function planUnion(lists) {
  return new Set([...(lists.active ?? []), ...(lists.queue ?? []), ...(lists.backlog ?? [])]);
}

/**
 * deriveDoneEvents(revisions) -> { done: [{id, date, hash}], dropped: [...] }
 * revisions: oldest→newest [{ hash, date, subject, lists }].
 * An id that disappears from the union between consecutive revisions completed
 * at that commit — unless the commit subject marks it as dropped.
 */
export function deriveDoneEvents(revisions) {
  const done = [];
  const dropped = [];
  for (let i = 1; i < revisions.length; i++) {
    const prev = planUnion(revisions[i - 1].lists);
    const cur = planUnion(revisions[i].lists);
    const { hash, date, subject = '' } = revisions[i];
    for (const id of prev) {
      if (cur.has(id)) continue;
      const target = subject.startsWith('plan: drop') && subject.includes(id) ? dropped : done;
      target.push({ id, date, hash });
    }
  }
  return { done: done.reverse(), dropped: dropped.reverse() }; // newest first
}
