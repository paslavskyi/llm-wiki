// Session snapshot injected by the SessionStart hook (after obsidian-mind):
// the few facts every session needs, under a byte budget with a size meter.
// Blocks are ordered by priority; when over budget the lowest-priority blocks
// go first. Pure — the CLI (tools/session-start.mjs) gathers the inputs.

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// summariseHealth(md) → ["<section>: <count>", …] for non-empty sections.
export function summariseHealth(md) {
  const out = [];
  let title = null;
  let bullets = [];
  const flush = () => {
    if (!title || !bullets.length) return;
    const gaps = bullets.length === 1 && bullets[0].match(/^(\d+) gap/);
    out.push(`${title}: ${gaps ? gaps[1] : bullets.length}`);
  };
  for (const line of String(md ?? '').split(/\r?\n/)) {
    const h = line.match(/^### (.+?)(?: \(.*\))?$/);
    if (h) { flush(); title = h[1]; bullets = []; continue; }
    if (line.startsWith('## ')) { flush(); title = null; continue; }
    if (title && line.startsWith('- ')) bullets.push(line.slice(2));
  }
  flush();
  return out;
}

export function buildSessionContext({ config, state, domains, plan, healthMd, budget = 1500 }) {
  const total = Object.values(domains ?? {}).reduce((s, n) => s + n, 0);
  const byDomain = Object.entries(domains ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([d, n]) => `${d} ${n}`).join(', ');
  const attention = summariseHealth(healthMd);
  const focus = oneLine(state?.focus);
  const next = oneLine(state?.next);

  const header = `[kb] session snapshot — mode ${config?.mode ?? 'debug'}, language ${config?.language ?? 'uk'}`;
  const blocks = [ // priority order
    `Focus: ${focus ? clip(focus, 300) : '(not set — STATE.md)'}`,
    next ? `Next step: ${clip(next, 300)}` : null,
    plan
      ? `Plan: active ${plan.active?.length ? plan.active.join(', ') : '—'} · next ready ${plan.next ?? '—'} · ${plan.queued ?? 0} queued`
      : 'Plan: none yet',
    `Attention: ${attention.length ? attention.join(' · ') : 'nothing flagged'}`,
    `Notes: ${total}${byDomain ? ` (${byDomain})` : ''}`,
  ].filter(Boolean);
  const footer = (bytes) => `[kb] ${bytes}/${budget} bytes · full picture: kb-orient · before writing a note: kb-capture/formats.md`;

  const render = (bs) => {
    const body = [header, ...bs].join('\n');
    // the meter reports the final size, so iterate until the number is stable
    let size = Buffer.byteLength(body) + 1 + Buffer.byteLength(footer(0));
    for (let i = 0; i < 3; i++) size = Buffer.byteLength(`${body}\n${footer(size)}`);
    return `${body}\n${footer(size)}`;
  };
  const kept = [...blocks];
  let out = render(kept);
  while (Buffer.byteLength(out) > budget && kept.length > 1) {
    kept.pop();
    out = render(kept);
  }
  return out;
}
