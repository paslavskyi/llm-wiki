export function domainOf(filePath) {
  const norm = filePath.replaceAll('\\', '/');
  // lastIndexOf, not indexOf: the repo root itself can contain the substring
  // "knowledge/" (e.g. ".../altus-knowledge/knowledge/vision/..."). Matching the
  // first occurrence would pick the repo-name fragment and collapse every note
  // into one "knowledge" domain. The deepest "knowledge/" is the real root.
  const idx = norm.lastIndexOf('knowledge/');
  if (idx === -1) return 'unknown';
  const rest = norm.slice(idx + 'knowledge/'.length);
  const top = rest.split('/')[0];
  return top || 'unknown';
}
