// Altus product dashboard client — renders /api/dashboard + /api/note/:id.
// Read-only viewer: plan changes happen in dialogue (kb-plan).
'use strict';

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const $ = id => document.getElementById(id);

let state = { data: null, milFilter: 'active', charts: {} };

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Minimal inline markdown for one-liners: **bold**, `code`, [[ID]] chips.
function mdInline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="mono">$1</code>')
    .replace(/\[\[([A-Z]+-[\w-]+)\]\]/g, (_, id) => nidChip(id));
}

// Full markdown (drawer, live tail) via vendored marked; [[ID]] → chips first.
function mdFull(s) {
  const pre = String(s ?? '').replace(/\[\[([A-Z]+-[\w-]+)\]\]/g, '%%NID:$1%%');
  const html = marked.parse(pre, { async: false });
  return html.replace(/%%NID:([A-Z]+-[\w-]+)%%/g, (_, id) => nidChip(id));
}

function idClass(id) {
  if (/^MIL-/.test(id)) return 'mil';
  if (/^GOAL-/.test(id)) return 'goal';
  if (/^PLAN-/.test(id)) return 'plan';
  if (/^RISK-/.test(id)) return 'risk';
  if (/^Q-/.test(id)) return 'q';
  if (/^ASMP-/.test(id)) return 'asmp';
  return '';
}

const nidChip = id => `<span class="nid ${idClass(id)}" data-note="${esc(id)}" role="button" tabindex="0">${esc(id)}</span>`;

function noteLi(n, { meta = '', badge = true, num = null, done = false } = {}) {
  const sum = n.summary ?? '';
  const goals = (n.goals ?? []).map(g => nidChip(g)).join(' ');
  return `<li ${done ? 'class="done-row"' : ''} data-note="${esc(n.id)}">
    ${num !== null ? `<span class="qpos">${num}</span>` : ''}
    ${done ? '<span class="check">✓</span>' : ''}
    <span class="nid ${idClass(n.id)}">${esc(n.id)}</span>
    <span class="ntitle">${esc(n.title)}<span class="nsum">${esc(sum).slice(0, 160)}${sum.length > 160 ? '…' : ''}</span></span>
    ${goals}
    ${badge && n.status ? `<span class="badge ${esc(n.status)}">${esc(n.status)}</span>` : ''}
    ${meta ? `<span class="nmeta">${esc(meta)}</span>` : ''}
  </li>`;
}

function renderList(el, items, opts = {}) {
  el.innerHTML = items.length
    ? items.map((n, i) => noteLi(n, { ...opts, num: opts.numbered ? i + 1 : null, meta: opts.metaOf ? opts.metaOf(n) : '' })).join('')
    : `<li class="empty">${opts.emptyText ?? 'порожньо'}</li>`;
}

/* ── header / hero ─────────────────────────────────────────────── */

function renderHeader(d) {
  $('repo-name').textContent = d.repo ?? '?';
  $('git-branch').textContent = d.git?.branch ?? '?';
  $('git-commit').textContent = d.git ? `${d.git.lastCommit.hash} ${d.git.lastCommit.date}` : 'git недоступний';
  $('notes-total').textContent = `${d.totals.live} нотаток`;
  const dirty = d.git?.dirtyKnowledgeFiles ?? 0;
  $('freshness').textContent = dirty
    ? `⚠ ${dirty} незакомічених змін у knowledge/`
    : `дані станом на ${new Date(d.generatedAt).toLocaleTimeString('uk-UA')}`;
}

function renderHero(d) {
  $('hero-focus').innerHTML = mdInline(d.state.focus) || '<span class="dim">STATE.md не знайдено</span>';
  $('hero-phase').innerHTML = mdInline(d.state.phase);
}

/* ── Продукт ───────────────────────────────────────────────────── */

const TL_STATE_LABELS = {
  done: 'досягнуто', inwork: 'в роботі', 'inwork-overdue': 'в роботі · прострочено',
  overdue: 'прострочено', next: 'наступна', planned: 'заплановано',
};

function renderTimeline(d) {
  const box = $('timeline');
  if (!d.timeline || !d.timeline.stages.length) {
    box.innerHTML = '<div class="empty">Timeline не заданий — створи TL-001 зі стадіями</div>';
    return;
  }
  const { stages, nowIndex } = d.timeline;
  const stageHtml = (s) => `
    <div class="tl-stage ${s.state}" data-note="${esc(s.id)}" role="button" tabindex="0">
      <div class="tl-track"><span class="seg-line pre"></span><span class="tl-dot"></span><span class="seg-line post"></span></div>
      <div class="tl-body">
        <div class="tl-name">${esc(s.title)}</div>
        <div class="tl-meta">${esc(s.id)}${s.due ? ` · due ${esc(s.due)}` : ''}</div>
        <span class="tl-state">${TL_STATE_LABELS[s.state] ?? s.state}</span>
      </div>
    </div>`;
  const nowHtml = `
    <div class="tl-now" aria-label="Ми зараз тут">
      <div class="tl-now-pin">▼ ми тут</div>
      <div class="tl-track"><span class="seg-line"></span><span class="tl-now-dot"></span><span class="seg-line" style="background:var(--baseline)"></span></div>
    </div>`;
  box.innerHTML = stages.map((s, i) => (i === nowIndex ? nowHtml : '') + stageHtml(s)).join('')
    + (nowIndex === stages.length ? nowHtml : '');
}

function renderGoals(d) {
  const grid = $('goals-grid');
  if (!d.goals.length) {
    grid.innerHTML = '<div class="empty">Цілей ще немає — створи діалогом: «Створи Goal …» (kb-goal)</div>';
    return;
  }
  grid.innerHTML = d.goals.map(g => {
    const { done, total } = g.progress;
    const pct = total ? Math.round(done / total * 100) : 0;
    const b = g.planBreakdown;
    return `<div class="goal-card" data-note="${esc(g.id)}" role="button" tabindex="0">
      <span class="nid goal">${esc(g.id)}</span>
      <div class="goal-title">${esc(g.title)}</div>
      <div class="goal-sum">${esc(g.summary).slice(0, 130)}${g.summary.length > 130 ? '…' : ''}</div>
      <div class="goal-progress"><div class="bar"><span style="width:${pct}%"></span></div><span class="goal-pct">${total ? `${pct}%` : '—'}</span></div>
      <div class="goal-break">задач <b>${total}</b> · done <b>${done}</b> · активні <b>${b.active}</b> · в черзі <b>${b.queue}</b> · backlog <b>${b.backlog}</b></div>
    </div>`;
  }).join('');
}

function renderVision(d) {
  const lead = d.vision.find(v => v.id === 'VIS-001') ?? d.vision[0];
  $('vision-lead').innerHTML = lead
    ? `<div class="hero-focus" style="font-size:14.5px">${mdInline(lead.summary)}</div>`
    : '<div class="empty">немає vision-нотаток</div>';
  $('vision-chips').innerHTML = d.vision
    .filter(v => v !== lead)
    .map(v => `<span class="chip" data-note="${esc(v.id)}" role="button" tabindex="0">${esc(v.title)}</span>`)
    .join('');
}

function renderKpi(d) {
  $('kpi-box').innerHTML = d.kpis.length
    ? `<ul class="notelist">${d.kpis.map(k => noteLi(k)).join('')}</ul>`
    : `<div class="empty">KPI ще не визначені. Відкрите питання: як міряти успіх без телеметрії — ${nidChip('Q-004')}</div>`;
}

function renderMilestones(d) {
  const f = state.milFilter;
  const items = d.milestones.filter(m =>
    f === 'all' ? true : f === 'proposed' ? m.status === 'proposed' : m.status === 'accepted');
  renderList($('mil-list'), items);
}

/* ── Розробка ──────────────────────────────────────────────────── */

function renderDelivery(d) {
  const p = d.plan;
  if (!p) {
    $('wip-list').innerHTML = '<div class="empty">PLAN-001 не знайдено</div>';
    return;
  }
  $('wip-list').innerHTML = p.active.length
    ? p.active.map(n => `<div class="wip-card" data-note="${esc(n.id)}" role="button" tabindex="0">
        <span class="nid ${idClass(n.id)}">${esc(n.id)}</span>
        <span class="ntitle" style="font-weight:600; color:var(--ink)"> ${esc(n.title)}</span>
        ${(n.goals ?? []).map(nidChip).join(' ')}
        <div class="nsum">${esc(n.summary).slice(0, 220)}</div>
      </div>`).join('')
    : '<div class="empty">нічого не в розробці — візьми наступну задачу: «беремо наступну» (kb-plan)</div>';

  renderList($('todo-list'), p.queue, { numbered: true, badge: false, emptyText: 'черга порожня' });
  renderList($('done-list'), p.done, { done: true, badge: false, metaOf: n => n.date, emptyText: 'ще нічого не завершено в рамках плану' });
  renderList($('parked-list'), p.backlog, { badge: false, emptyText: 'backlog порожній' });
}

function renderDebt(d) {
  const tags = Object.entries(d.techdebt.byTag).sort((a, b) => b[1].length - a[1].length);
  $('debt-tags').innerHTML = tags.map(([t, ids]) => `<span class="chip tag">${esc(t)} · ${ids.length}</span>`).join('');
  renderList($('debt-list'), d.techdebt.risks, { badge: false, emptyText: 'боргових ризиків немає 🎉' });
}

function renderLiveTail(d) {
  $('livetail').innerHTML = d.state.liveTail
    ? mdFull(d.state.liveTail)
    : '<div class="empty">у STATE.md немає секції Live tail</div>';
}

/* ── Мапа ──────────────────────────────────────────────────────── */

let mindmapLoaded = false;
let mapTree = null;
const mapNodes = new Map(); // uid → our tree node (identity survives ECharts cloning)

// Collapse state lives in OUR tree (children ⇄ _children), not in ECharts:
// the canvas width must follow the actually-expanded depth, so the layout
// never strands columns outside the viewport nor cramps an expanded branch.
// filled dot = collapsed (expandable), hollow = expanded
function groupDotStyle(node) {
  node.itemStyle = node._children
    ? { color: css('--series-1'), borderColor: css('--series-1') }
    : { color: css('--page'), borderColor: css('--series-1'), borderWidth: 1.5 };
}

function prepMapTree(tree) {
  mapNodes.clear();
  let uid = 0;
  const walk = (node, depth) => {
    node.uid = uid++;
    mapNodes.set(node.uid, node);
    for (const ch of node.children ?? []) walk(ch, depth + 1);
    if (depth >= 1 && node.children?.length) { // start with only the areas visible
      node._children = node.children;
      node.children = [];
    }
    if (node.kind === 'topic' || node.kind === 'root' || node.kind === 'bucket') groupDotStyle(node);
  };
  walk(tree, 0);
  return tree;
}

function visibleMapDepth(node, depth = 0) {
  let max = depth;
  for (const ch of node.children ?? []) max = Math.max(max, visibleMapDepth(ch, depth + 1));
  return max;
}

const MAP_COL = 440; // px per expanded layer (label cap 320 + gap)

function fitMapWidth() {
  const wrap = document.querySelector('.map-scroll');
  const el = $('chart-mindmap');
  const depth = visibleMapDepth(mapTree);
  const w = Math.max(wrap.clientWidth, 90 + 340 + depth * MAP_COL);
  el.style.width = `${w}px`;
  state.charts['chart-mindmap']?.resize();
}

async function renderMindmap() {
  if (mindmapLoaded) return;
  const res = await fetch('/api/mindmap', { cache: 'no-store' });
  if (!res.ok) return;
  mapTree = prepMapTree(await res.json());
  const tree = mapTree;
  mindmapLoaded = true;

  const c = chart('chart-mindmap', {
    animation: false,
    tooltip: {
      trigger: 'item', triggerOn: 'mousemove',
      backgroundColor: css('--surface-2'), borderColor: css('--border'),
      textStyle: { color: css('--ink') },
      formatter: p => {
        const d = p.data;
        if (d.kind === 'topic' || d.kind === 'root' || d.kind === 'bucket') {
          return `${esc(d.name)}<br>${d.value} нотаток у гілці`;
        }
        // leaves are truncated on canvas — the tooltip carries the full title
        return `<b>${esc(d.noteId)}</b> · ${esc(d.kind)}<br>${esc(d.name.replace(/^\S+\s/, ''))}`;
      },
    },
    series: [{
      type: 'tree', data: [tree],
      layout: 'orthogonal', orient: 'LR',
      top: '2%', bottom: '2%', left: 90, right: 340,
      // collapse/expand is handled by our click handler (children ⇄ _children
      // in mapTree) so the canvas width can track the expanded depth.
      roam: true, expandAndCollapse: false, initialTreeDepth: -1,
      symbol: 'circle',
      symbolSize: d => 8,
      itemStyle: { color: css('--series-1'), borderColor: css('--baseline') },
      lineStyle: { color: css('--grid'), width: 1.2, curveness: 0.5 },
      label: {
        color: css('--ink'), fontSize: 13, position: 'left',
        verticalAlign: 'middle', align: 'right', distance: 8,
        // hard pixel cap: a label can never run into the next column
        // (full title lives in the tooltip)
        width: 300, overflow: 'truncate',
        // counts on group nodes: «CLI та сервер · 26» — visible weight while collapsed
        formatter: p => {
          const d = p.data;
          if (d.kind === 'root') return d.name;
          if (d.kind === 'topic' || d.kind === 'bucket') return `${d.name} · ${d.value}`;
          return d.name;
        },
      },
      leaves: {
        label: {
          position: 'right', align: 'left', color: css('--ink-2'), fontSize: 12,
          width: 320, overflow: 'truncate',
        },
        itemStyle: { color: css('--surface-2'), borderColor: css('--muted'), borderWidth: 1 },
      },
      emphasis: { focus: 'descendant', itemStyle: { color: css('--series-2') } },
    }],
  });
  fitMapWidth();
  c.off('click');
  c.on('click', params => {
    const d = params.data ?? {};
    const isGroup = d.kind === 'topic' || d.kind === 'root' || d.kind === 'bucket';
    if (!isGroup) { // note leaf → drawer
      if (d.noteId) openNote(d.noteId);
      return;
    }
    const node = mapNodes.get(d.uid);
    if (!node) return;
    if (node.children?.length) { node._children = node.children; node.children = []; }
    else if (node._children) { node.children = node._children; node._children = null; }
    else return; // group with no children at all
    groupDotStyle(node);
    fitMapWidth();
    c.setOption({ series: [{ data: [mapTree] }] });
  });
}

/* ── KB ────────────────────────────────────────────────────────── */

function renderTiles(d) {
  const set = (id, v, zeroGood = false) => {
    const el = $(id);
    el.textContent = v;
    if (zeroGood) { if (v === 0) el.dataset.zero = ''; else delete el.dataset.zero; }
  };
  set('t-live', d.totals.live);
  set('t-goals', d.goals.length);
  set('t-deprecated', d.totals.deprecated);
  set('t-risks', d.health.risks.length, true);
  set('t-questions', d.health.questions.length, true);
}

function renderHealth(d) {
  renderList($('health-list'), [...d.health.risks, ...d.health.questions, ...d.health.assumptions],
    { badge: false, emptyText: 'все чисто' });
}

function chart(elId, option) {
  const el = $(elId);
  let c = state.charts[elId];
  if (!c) { c = echarts.init(el, null, { renderer: 'svg' }); state.charts[elId] = c; }
  c.setOption(option, true);
  return c;
}

const AXIS = () => ({
  axisLine: { lineStyle: { color: css('--baseline') } },
  axisTick: { show: false },
  axisLabel: { color: css('--muted'), fontFamily: 'Consolas' },
  splitLine: { lineStyle: { color: css('--grid') } },
});

function renderDomainChart(d) {
  const entries = Object.entries(d.totals.byDomain).sort((a, b) => a[1] - b[1]);
  chart('chart-domains', {
    animation: false,
    grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', ...AXIS() },
    yAxis: { type: 'category', data: entries.map(e => e[0]), ...AXIS(), splitLine: { show: false } },
    tooltip: { trigger: 'item', backgroundColor: css('--surface-2'), borderColor: css('--border'), textStyle: { color: css('--ink') } },
    series: [{
      type: 'bar', data: entries.map(e => e[1]),
      barMaxWidth: 14, itemStyle: { color: css('--series-1'), borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', color: css('--ink-2'), fontFamily: 'Consolas' },
    }],
  });
}

function renderPulseChart(d) {
  const rows = d.trends.byMonth;
  chart('chart-pulse', {
    animation: false,
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: {
      top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 4,
      textStyle: { color: css('--ink-2') },
      data: ['створені', 'оновлені'],
    },
    xAxis: { type: 'category', data: rows.map(r => r.month), boundaryGap: false, ...AXIS(), splitLine: { show: false } },
    yAxis: { type: 'value', ...AXIS() },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: css('--baseline') } },
      backgroundColor: css('--surface-2'), borderColor: css('--border'), textStyle: { color: css('--ink') },
    },
    series: [
      { name: 'створені', type: 'line', data: rows.map(r => r.created), symbolSize: 7, lineStyle: { width: 2, color: css('--series-1') }, itemStyle: { color: css('--series-1') } },
      { name: 'оновлені', type: 'line', data: rows.map(r => r.updated), symbolSize: 7, lineStyle: { width: 2, color: css('--series-2') }, itemStyle: { color: css('--series-2') } },
    ],
  });
}

function renderRecent(d) {
  renderList($('recent-list'), d.recentNotes, { badge: false, metaOf: n => n.updated ?? '' });
}

/* ── Drawer ────────────────────────────────────────────────────── */

async function openNote(id) {
  const res = await fetch(`/api/note/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) return;
  const n = await res.json();
  $('dr-id').textContent = n.id;
  $('dr-id').className = `nid ${idClass(n.id)}`;
  $('dr-status').textContent = n.status;
  $('dr-status').className = `badge ${n.status}`;
  $('dr-title').textContent = n.title;
  $('dr-meta').textContent = [n.type, n.domain, n.priority, `створено ${n.created}`, `оновлено ${n.updated}`]
    .filter(Boolean).join(' · ');
  $('dr-tags').innerHTML = (n.tags ?? []).map(t => `<span class="chip tag">${esc(t)}</span>`).join('');
  $('dr-summary').innerHTML = mdInline(n.summary);
  $('dr-body').innerHTML = n.body?.trim() ? mdFull(n.body) : '<span class="dim">(тіло порожнє)</span>';

  const scopeItems = n.scope ?? (n.plan ? [
    ...n.plan.active.map(x => ({ ...x, _lane: 'активна' })),
    ...n.plan.queue.map((x, i) => ({ ...x, _lane: `черга №${i + 1}` })),
    ...n.plan.backlog.map(x => ({ ...x, _lane: 'backlog' })),
  ] : null);
  $('dr-scope-box').hidden = !scopeItems;
  if (scopeItems) {
    renderList($('dr-scope'), scopeItems, { metaOf: x => x._lane ?? '', emptyText: 'scope порожній — задачі ще не сформульовані' });
  }
  $('dr-links-box').hidden = !(n.links ?? []).length;
  $('dr-links').innerHTML = (n.links ?? []).map(l => nidChip(l.id)).join(' ');
  $('dr-back-box').hidden = !(n.backlinks ?? []).length;
  $('dr-backlinks').innerHTML = (n.backlinks ?? []).map(l => nidChip(l.id)).join(' ');

  $('drawer').hidden = false;
  $('drawer-backdrop').hidden = false;
  $('drawer').scrollTop = 0;
}

function closeDrawer() {
  $('drawer').hidden = true;
  $('drawer-backdrop').hidden = true;
}

/* ── wiring ────────────────────────────────────────────────────── */

function renderAll() {
  const d = state.data;
  renderHeader(d); renderHero(d);
  renderTimeline(d); renderGoals(d); renderVision(d); renderKpi(d); renderMilestones(d);
  renderDelivery(d); renderDebt(d); renderLiveTail(d);
  renderTiles(d); renderHealth(d); renderDomainChart(d); renderPulseChart(d); renderRecent(d);
  $('app').classList.remove('loading');
  $('app').removeAttribute('aria-busy');
}

async function load() {
  const res = await fetch('/api/dashboard', { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}`);
  state.data = await res.json();
  renderAll();
  mindmapLoaded = false; // ⟳ refetches the map too
  if (!document.querySelector('main[data-panel="map"]').hidden) {
    renderMindmap().catch(() => {});
  }
}

function showError(err) {
  $('hero-focus').innerHTML = `<span style="color:var(--status-critical)">Не вдалося завантажити дані: ${esc(err.message)}.</span> Перевір, що сервер запущено: <code class="mono">npm run dashboard</code>`;
  $('app').classList.remove('loading');
}

document.querySelector('.tabbar').addEventListener('click', e => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  for (const b of document.querySelectorAll('.tabbar button')) b.classList.toggle('on', b === btn);
  for (const p of document.querySelectorAll('main[data-panel]')) p.hidden = p.dataset.panel !== btn.dataset.tab;
  // charts init lazily/hidden get zero size — the map inits on first open
  if (btn.dataset.tab === 'map') renderMindmap().catch(() => {});
  Object.values(state.charts).forEach(c => c.resize());
});

$('mil-filter').addEventListener('click', e => {
  const btn = e.target.closest('button[data-f]');
  if (!btn) return;
  state.milFilter = btn.dataset.f;
  for (const b of $('mil-filter').querySelectorAll('button')) b.classList.toggle('on', b === btn);
  renderMilestones(state.data);
});

// Any [data-note] element anywhere (lists, chips, drawer content) opens the drawer.
document.addEventListener('click', e => {
  const t = e.target.closest('[data-note]');
  if (t) { openNote(t.dataset.note); return; }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawer();
  const t = e.target.closest?.('[data-note]');
  if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openNote(t.dataset.note); }
});
$('dr-close').addEventListener('click', closeDrawer);
$('drawer-backdrop').addEventListener('click', closeDrawer);
$('refresh').addEventListener('click', () => load().catch(showError));
window.addEventListener('resize', () => Object.values(state.charts).forEach(c => c.resize()));

load().catch(showError);
