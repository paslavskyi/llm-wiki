// Assumption lifecycle (after GraphRAG claim status TRUE / FALSE / SUSPECTED):
//   validation: open | validated | invalidated   (only on `assumption` notes)
// `status` still says how settled the NOTE is (an accepted assumption = we
// consciously proceed on it); `validation` says whether reality confirmed it.
// A verdict must cite its evidence via `sources:`.

export const VERDICTS = new Set(['validated', 'invalidated']);

// checkValidation: errors (strings, without the id).
export function checkValidation(fm) {
  if (fm.validation === undefined) return [];
  if (fm.type !== 'assumption') return ['validation is only for assumption notes'];
  if (VERDICTS.has(fm.validation) && !(Array.isArray(fm.sources) && fm.sources.length)) {
    return [`validation "${fm.validation}" needs evidence — cite the source(s) in \`sources:\``];
  }
  return [];
}
