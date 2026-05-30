// Build a deterministic forest of topic nodes from notes.
// A topic note (type === 'topic') becomes a tree node; its `parent` (a TOP- id
// or null) sets its position. A concrete note attaches to the node named by its
// `topic` field. Notes with no resolvable topic go to `unassigned`.
// Robust to dangling parents (node becomes a root) and cycles (no infinite loop).

function byId(a, b) {
  return String(a.id).localeCompare(String(b.id));
}

export function buildTree(notes) {
  const nodes = new Map();
  for (const n of notes) {
    const fm = n.frontmatter;
    if (fm.type === 'topic' && fm.id) {
      nodes.set(fm.id, {
        id: fm.id,
        title: fm.title ?? fm.id,
        summary: fm.summary ?? '',
        parent: typeof fm.parent === 'string' ? fm.parent : null,
        children: [],
        notes: [],
      });
    }
  }

  const unassigned = [];
  for (const n of notes) {
    const fm = n.frontmatter;
    if (fm.type === 'topic') continue;
    const entry = { id: fm.id, title: fm.title ?? fm.id, type: fm.type };
    const t = fm.topic;
    if (typeof t === 'string' && nodes.has(t)) {
      nodes.get(t).notes.push(entry);
    } else {
      unassigned.push(entry);
    }
  }

  const roots = [];
  for (const node of nodes.values()) {
    if (node.parent && nodes.has(node.parent)) {
      nodes.get(node.parent).children.push(node);
    } else {
      roots.push(node);
    }
  }

  // break cycles: any node not reachable from a root is part of a cycle.
  // Promote it to a root AND detach it from its (cyclic) parent so the tree
  // recursion below cannot loop forever.
  const reachable = new Set();
  const stack = [...roots];
  while (stack.length) {
    const node = stack.pop();
    if (reachable.has(node.id)) continue;
    reachable.add(node.id);
    stack.push(...node.children);
  }
  for (const node of nodes.values()) {
    if (!reachable.has(node.id)) {
      if (node.parent && nodes.has(node.parent)) {
        const siblings = nodes.get(node.parent).children;
        const i = siblings.indexOf(node);
        if (i !== -1) siblings.splice(i, 1);
      }
      roots.push(node);
    }
  }

  const sortRec = (node) => {
    node.children.sort(byId);
    node.notes.sort(byId);
    node.children.forEach(sortRec);
  };
  roots.sort(byId);
  roots.forEach(sortRec);
  unassigned.sort(byId);

  return { roots, unassigned };
}
