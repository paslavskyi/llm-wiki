// Inline uncertainty markers inside a note body (after Spec Kit's
// [NEEDS CLARIFICATION] and BMAD's [ASSUMPTION]):
//   [NEEDS CLARIFICATION: what is unknown]  — an open question local to this note
//   [ASSUMPTION: what we guessed]           — a guess the note relies on
// They keep uncertainty visible where it lives; a note cannot be `accepted`
// while any remain. Code (fenced or inline) is ignored.

const MARKER_RE = /\[(NEEDS CLARIFICATION|ASSUMPTION)(?::\s*([^\]]*))?\]/g;

function stripCode(body) {
  return String(body ?? '')
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '')
    .replace(/`[^`\n]*`/g, '');
}

export function findMarkers(body) {
  return [...stripCode(body).matchAll(MARKER_RE)]
    .map(m => ({ kind: m[1], text: (m[2] ?? '').trim() }));
}

// checkMarkers: errors (strings, without the id) for an accepted note with markers.
export function checkMarkers(fm, body) {
  if (fm.status !== 'accepted') return [];
  const n = findMarkers(body).length;
  return n ? [`accepted with ${n} unresolved marker(s) — resolve them or keep the note proposed/draft`] : [];
}
