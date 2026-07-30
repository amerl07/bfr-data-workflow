export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Pairwise-complete Pearson correlation — rows missing either value are
 * dropped rather than treated as 0, so sparse metrics don't skew the result.
 * Returns null (render as "—") when fewer than 2 complete pairs or no
 * variance in either series. */
export function pearsonCorrelation(
  xs: (number | null)[],
  ys: (number | null)[],
): number | null {
  const pairs: [number, number][] = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y)) {
      pairs.push([x, y]);
    }
  }
  if (pairs.length < 2) return null;
  const n = pairs.length;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let num = 0;
  let denomX = 0;
  let denomY = 0;
  for (const [x, y] of pairs) {
    const dx = x - mx;
    const dy = y - my;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  if (denomX === 0 || denomY === 0) return null;
  return num / Math.sqrt(denomX * denomY);
}

export interface HistogramBucket {
  min: number;
  max: number;
  count: number;
}

export function histogram(values: number[], bucketCount = 10): HistogramBucket[] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return [];
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (min === max) {
    return [{ min, max, count: finite.length }];
  }
  const width = (max - min) / bucketCount;
  const buckets: HistogramBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    min: min + i * width,
    max: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of finite) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bucketCount) idx = bucketCount - 1;
    if (idx < 0) idx = 0;
    buckets[idx].count += 1;
  }
  return buckets;
}

export function countBy<T>(items: T[], keyFn: (item: T) => string): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item) || "—";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
}

export interface LeaderboardEntry<T> {
  row: T;
  value: number;
}

export function leaderboard<T>(
  rows: T[],
  valueFn: (row: T) => number | null,
  order: "asc" | "desc",
  limit = 5,
): LeaderboardEntry<T>[] {
  return rows
    .map((row) => ({ row, value: valueFn(row) }))
    .filter((r): r is LeaderboardEntry<T> => r.value !== null && Number.isFinite(r.value))
    .sort((a, b) => (order === "asc" ? a.value - b.value : b.value - a.value))
    .slice(0, limit);
}
