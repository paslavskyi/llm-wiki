// The single definition of an "open" cross-cutting item (question / risk /
// assumption). Everything that reports open items (health report, dashboard)
// MUST use this — two local definitions already diverged once (graph counted
// a deprecated item as open; the dashboard did not).
export const OPEN_TYPES = new Set(['question', 'risk', 'assumption']);

export function isOpenNote(fm) {
  return OPEN_TYPES.has(fm.type)
    && fm.status !== 'accepted'
    && fm.status !== 'deprecated';
}
