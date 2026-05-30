export function domainOf(filePath) {
  const norm = filePath.replaceAll('\\', '/');
  const idx = norm.indexOf('knowledge/');
  if (idx === -1) return 'unknown';
  const rest = norm.slice(idx + 'knowledge/'.length);
  const top = rest.split('/')[0];
  return top || 'unknown';
}
