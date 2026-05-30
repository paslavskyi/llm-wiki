// Pure timestamp logic for the persistence evaluator. All times are epoch ms.

import { readFile } from 'node:fs/promises';

export async function readMarker(path) {
  try {
    const n = Number(await readFile(path, 'utf8'));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function ageHours(fromMs, nowMs) {
  return (nowMs - fromMs) / 3600_000;
}

// What the oldest-dirty marker should become:
// - clean tree → null (clear it)
// - dirty + no existing marker → now (first time dirty)
// - dirty + existing marker → keep existing (oldest wins)
export function nextMarkerState({ dirty, existing, now }) {
  if (!dirty) return null;
  return existing ?? now;
}

// Debounce: remind only if never reminded, or the window has elapsed.
export function shouldRemind({ lastRemind, now, everyHours }) {
  if (lastRemind == null) return true;
  return ageHours(lastRemind, now) >= everyHours;
}
