// Jaro-Winkler string similarity in [0,1]. Pure, no dependencies.

export function normalizeForCompare(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // strip punctuation → space
    .replace(/\s+/g, ' ')
    .trim();
}

function jaro(a, b) {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t /= 2;
  return (matches / a.length + matches / b.length + (matches - t) / matches) / 3;
}

export function jaroWinkler(a, b, prefixScale = 0.1) {
  a = String(a ?? '');
  b = String(b ?? '');
  const j = jaro(a, b);
  let prefix = 0;
  const maxPrefix = 4;
  while (prefix < maxPrefix && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix++;
  }
  return j + prefix * prefixScale * (1 - j);
}
