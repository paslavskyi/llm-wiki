// KB dashboard server — read-only viewer over knowledge/.
// Serves the hand-written SPA in public/ and a GET-only JSON API computed
// live from note frontmatter + git history. Never writes to the KB.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname, resolve, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadNotes as loadRawNotes } from '../../lib/load-notes.mjs';
import { domainOf } from '../../lib/domain.mjs';
import { loadPlanHistory } from '../../lib/plan-history.mjs';
import { buildTree } from '../../lib/mindmap.mjs';
import { isOpenNote } from '../../lib/open.mjs';
import {
  tally, parseState, monthlyTrend, refOf, expandRef, planMembership,
  computeGoals, computeTimeline, computeTechdebt,
} from '../../lib/dashboard-data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', '..');
const PUBLIC_DIR = join(here, 'public');
const PORT = Number(process.env.KB_DASH_PORT ?? 4321);
const HOST = '127.0.0.1';

const run = promisify(execFile);
const git = (...args) => run('git', ['-c', 'core.quotepath=false', ...args], { cwd: ROOT })
  .then(r => r.stdout.trim());

function pick(n) {
  const fm = n.frontmatter;
  return {
    id: fm.id,
    type: fm.type,
    title: fm.title,
    status: fm.status,
    priority: fm.priority ?? null,
    summary: fm.summary ?? '',
    topic: fm.topic ?? null,
    parent: fm.parent !== undefined ? fm.parent : undefined,
    due: fm.due ?? null,
    sequence: Array.isArray(fm.sequence) ? fm.sequence : undefined,
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    scope: Array.isArray(fm.scope) ? fm.scope : undefined,
    active: Array.isArray(fm.active) ? fm.active : undefined,
    queue: Array.isArray(fm.queue) ? fm.queue : undefined,
    backlog: Array.isArray(fm.backlog) ? fm.backlog : undefined,
    links: n.links,
    created: fm.created ?? null,
    updated: fm.updated ?? null,
    domain: domainOf(n.filePath),
  };
}

async function gitInfo() {
  try {
    const [branch, last, dirty] = await Promise.all([
      git('rev-parse', '--abbrev-ref', 'HEAD'),
      git('log', '-1', '--pretty=format:%h%x09%ad%x09%s', '--date=short'),
      git('status', '--porcelain', '--', 'knowledge/'),
    ]);
    const [hash, date, subject] = last.split('\t');
    return { branch, lastCommit: { hash, date, subject }, dirtyKnowledgeFiles: dirty ? dirty.split('\n').length : 0 };
  } catch {
    return null;
  }
}

// Weekly commit counts touching knowledge/ (ISO week keyed by its Monday).
async function gitActivity() {
  try {
    const out = await git('log', '--pretty=format:%ad', '--date=short', '--', 'knowledge/');
    const byWeek = new Map();
    for (const d of out.split('\n').filter(Boolean)) {
      const dt = new Date(d + 'T00:00:00Z');
      const day = (dt.getUTCDay() + 6) % 7; // Mon=0
      dt.setUTCDate(dt.getUTCDate() - day);
      const wk = dt.toISOString().slice(0, 10);
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1);
    }
    return [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([week, commits]) => ({ week, commits }));
  } catch {
    return [];
  }
}

async function loadNotes() {
  const raw = await loadRawNotes(ROOT);
  return raw.map(n => ({ ...pick(n), filePath: n.filePath, body: n.body }));
}

async function buildDashboard() {
  const notes = await loadNotes();
  const byId = new Map(notes.map(n => [n.id, n]));
  const live = notes.filter(n => n.status !== 'deprecated');
  const expand = id => expandRef(byId, id);

  const plan = live.find(n => n.type === 'plan') ?? null;
  const membership = planMembership(plan);
  const history = await loadPlanHistory(ROOT);
  const doneInPlan = new Set(history.done.map(e => e.id));

  const goals = computeGoals(live.filter(n => n.type === 'goal'),
    { byId, membership, doneInPlan });

  const goalsByMember = new Map();
  for (const g of goals) {
    for (const it of g.scope) {
      if (!goalsByMember.has(it.id)) goalsByMember.set(it.id, []);
      goalsByMember.get(it.id).push(g.id);
    }
  }
  const withGoals = id => ({ ...expand(id), goals: goalsByMember.get(id) ?? [] });

  const milestones = live.filter(n => n.type === 'milestone')
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const timeline = computeTimeline(live.find(n => n.type === 'timeline') ?? null, {
    byId,
    activeSet: new Set(plan?.active ?? []),
    doneInPlan,
    today: new Date().toISOString().slice(0, 10),
  });

  const open = live.filter(isOpenNote);
  const techdebt = computeTechdebt(live);

  const vision = live.filter(n => n.domain === 'vision')
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const kpis = live.filter(n => n.type === 'kpi');

  let state = { phase: '', focus: '', liveTail: '' };
  try { state = parseState(await readFile(join(ROOT, 'STATE.md'), 'utf8')); } catch { /* optional */ }

  const [gitMeta, activity] = await Promise.all([gitInfo(), gitActivity()]);

  const stripBody = ({ body, filePath, ...rest }) => rest;
  return {
    generatedAt: new Date().toISOString(),
    repo: basename(ROOT),
    git: gitMeta,
    state,
    totals: {
      notes: notes.length,
      live: live.length,
      deprecated: notes.length - live.length,
      byDomain: tally(live, 'domain'),
      byStatus: tally(live, 'status'),
      byType: tally(live, 'type'),
    },
    vision: vision.map(refOf),
    kpis: kpis.map(refOf),
    goals,
    plan: plan ? {
      id: plan.id,
      active: (plan.active ?? []).map(withGoals),
      queue: (plan.queue ?? []).map(withGoals),
      backlog: (plan.backlog ?? []).map(withGoals),
      done: history.done.map(e => ({ ...e, ...withGoals(e.id) })),
      dropped: history.dropped.map(e => ({ ...e, ...withGoals(e.id) })),
    } : null,
    techdebt: { risks: techdebt.risks.map(stripBody).map(refOf), byTag: techdebt.byTag },
    timeline,
    milestones: milestones.map(m => ({ ...refOf(m), due: m.due })),
    health: {
      questions: open.filter(n => n.type === 'question').map(refOf),
      risks: open.filter(n => n.type === 'risk').map(refOf),
      assumptions: open.filter(n => n.type === 'assumption').map(refOf),
    },
    recentNotes: live
      .filter(n => n.updated)
      .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
      .slice(0, 12)
      .map(n => ({ ...refOf(n), updated: n.updated })),
    trends: { byMonth: monthlyTrend(live), gitWeekly: activity },
  };
}

// Live mind-map: same topic forest as the offline index/mindmap.html, shaped
// for an ECharts tree series. Every node carries its note id → drawer.
const TYPE_LABELS = {
  feature: 'Фічі', requirement: 'Вимоги', nfr: 'NFR', story: 'Сторі',
  entity: 'Сутності', term: 'Терміни', decision: 'Рішення', risk: 'Ризики',
  question: 'Питання', assumption: 'Припущення', milestone: 'Віхи', kpi: 'KPI',
  goal: 'Цілі', plan: 'План', persona: 'Персони', segment: 'Сегменти',
  jtbd: 'JTBD', pain: 'Болі', competitor: 'Конкуренти',
  'market-insight': 'Ринкові інсайти', vision: 'Візія', principle: 'Принципи',
  'value-prop': 'Ціннісна пропозиція', positioning: 'Позиціювання',
  channel: 'Канали', pricing: 'Прайсинг', message: 'Меседжі', role: 'Ролі',
};
const BUCKET_THRESHOLD = 9; // a branch with this many notes gets type sub-groups

async function buildMindmap() {
  const notes = await loadNotes();
  const live = notes.filter(n => n.status !== 'deprecated');
  const { roots, unassigned } = buildTree(live.map(n => ({ frontmatter: n })));

  const noteLeaf = e => ({ name: `${e.id} ${e.title}`, noteId: e.id, kind: e.type, value: 1 });
  // Big fan-outs are unreadable as one column — fold a large branch's notes
  // into per-type sub-groups (only groups with 2+ notes; singletons stay flat).
  const groupNotes = list => {
    if (list.length < BUCKET_THRESHOLD) return list.map(noteLeaf);
    const byType = new Map();
    for (const e of list) {
      if (!byType.has(e.type)) byType.set(e.type, []);
      byType.get(e.type).push(e);
    }
    const out = [];
    for (const [type, items] of [...byType.entries()].sort((a, b) => b[1].length - a[1].length)) {
      if (items.length === 1) { out.push(noteLeaf(items[0])); continue; }
      out.push({
        name: TYPE_LABELS[type] ?? type, noteId: null, kind: 'bucket',
        value: items.length, children: items.map(noteLeaf),
      });
    }
    return out;
  };
  const topicNode = t => {
    const children = [...t.children.map(topicNode), ...groupNotes(t.notes)];
    const value = children.reduce((s, c) => s + (c.value ?? 1), 0);
    return { name: t.title, noteId: t.id, kind: 'topic', value, children };
  };
  const children = roots.map(topicNode);
  if (unassigned.length) {
    children.push({
      name: '(поза мапою)', noteId: null, kind: 'bucket',
      value: unassigned.length, children: unassigned.map(noteLeaf),
    });
  }
  return {
    name: 'Altus KB', noteId: null, kind: 'root',
    value: children.reduce((s, c) => s + c.value, 0),
    children,
  };
}

async function buildNoteDetail(id) {
  const notes = await loadNotes();
  const byId = new Map(notes.map(n => [n.id, n]));
  const n = byId.get(id);
  if (!n) return null;
  const backlinks = notes
    .filter(o => o.id !== id && o.links.includes(id))
    .map(o => ({ id: o.id, title: o.title, type: o.type, status: o.status }));
  const expandRefs = ids => (ids ?? []).map(x => {
    const t = byId.get(x);
    return { id: x, title: t?.title ?? '(?)', type: t?.type ?? null, status: t?.status ?? null };
  });
  return {
    id: n.id, type: n.type, title: n.title, status: n.status,
    summary: n.summary, tags: n.tags, topic: n.topic, domain: n.domain,
    created: n.created, updated: n.updated,
    priority: n.priority,
    body: n.body,
    scope: n.scope ? expandRefs(n.scope) : null,
    plan: n.type === 'plan'
      ? { active: expandRefs(n.active), queue: expandRefs(n.queue), backlog: expandRefs(n.backlog) }
      : null,
    links: expandRefs(n.links.filter(l => byId.has(l))),
    backlinks,
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const full = resolve(PUBLIC_DIR, rel);
  if (full !== PUBLIC_DIR && !full.startsWith(PUBLIC_DIR + sep)) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  try {
    const body = await readFile(full);
    res.writeHead(200, { 'content-type': MIME[extname(full)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET') { // read-only by construction
    res.writeHead(405, { allow: 'GET' }); res.end('read-only');
    return;
  }
  const { pathname } = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  try {
    if (pathname === '/api/dashboard') {
      sendJson(res, 200, await buildDashboard());
      return;
    }
    if (pathname === '/api/mindmap') {
      sendJson(res, 200, await buildMindmap());
      return;
    }
    const noteMatch = pathname.match(/^\/api\/note\/([A-Z]+-[A-Za-z0-9-]+)$/);
    if (noteMatch) {
      const detail = await buildNoteDetail(noteMatch[1]);
      if (detail) sendJson(res, 200, detail);
      else sendJson(res, 404, { error: `note ${noteMatch[1]} not found` });
      return;
    }
  } catch (err) {
    sendJson(res, 500, { error: String(err?.message ?? err) });
    return;
  }
  await serveStatic(res, pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`KB dashboard: http://${HOST}:${PORT} (read-only; Ctrl+C to stop)`);
});
