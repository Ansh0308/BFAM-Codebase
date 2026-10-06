// Compare dotted app versions ("1.4.0" vs "1.10.2") numerically, segment by segment.
// A missing or unreadable version never counts as "older" so a bad setting can't lock players out.
export function isOlderVersion(current: string, minimum: string): boolean {
  const parse = (v: string) =>
    v
      .trim()
      .split('.')
      .map((p) => Number.parseInt(p, 10));
  const a = parse(current);
  const b = parse(minimum);
  if (!minimum.trim() || [...a, ...b].some((n) => Number.isNaN(n))) return false;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
