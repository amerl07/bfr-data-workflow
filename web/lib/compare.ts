import { compareMetric, type MetricDef } from "./metrics";
import { absoluteDelta, percentDelta } from "./format";

/** Raw (absolute) force deltas smaller than this are treated as noise and
 * left uncolored on the Compare page. */
export const FORCE_DELTA_THRESHOLD_N = 1.5;

export interface CompareSelection {
  /** Selected job names, in display order, deduped. */
  sims: string[];
  /** Job name every other sim's deltas are computed against. Always one of
   * `sims` (the first, if `base` is missing/stale), or null when empty. */
  base: string | null;
}

/** Reads the Compare page's URL state: `?sim=X&sim=Y&...&base=Y`. Falls
 * back to the legacy two-sim `?a=X&b=Y` form so old shared links keep
 * working. */
export function parseCompareParams(params: URLSearchParams): CompareSelection {
  let sims = params.getAll("sim").filter(Boolean);
  if (sims.length === 0) {
    sims = [params.get("a"), params.get("b")].filter((s): s is string => !!s);
  }
  sims = [...new Set(sims)];
  const requestedBase = params.get("base");
  const base = requestedBase && sims.includes(requestedBase) ? requestedBase : sims[0] ?? null;
  return { sims, base };
}

export function buildCompareParams(
  current: URLSearchParams,
  { sims, base }: CompareSelection,
): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  for (const key of ["sim", "base", "a", "b"]) params.delete(key);
  for (const s of sims) params.append("sim", s);
  // Only written when it differs from the implicit default (first sim), so
  // a plain list of sims stays a short URL.
  if (base && base !== sims[0]) params.set("base", base);
  return params;
}

/** "better"/"worse" = green/red. null = leave uncolored. */
export type DeltaTone = "better" | "worse" | null;

function directionTone(metric: MetricDef, base: number, value: number): DeltaTone {
  if (metric.better === "neutral") {
    // No better/worse direction for positional/setup metrics (CoP, areas,
    // radiator, ...), so color purely by sign: up = green, down = red.
    if (value === base) return null;
    return value > base ? "better" : "worse";
  }
  const cmp = compareMetric(value, base, metric.better);
  return cmp === 1 ? "better" : cmp === -1 ? "worse" : null;
}

/** Tone for a raw (absolute) delta: only force metrics (unit "N") are
 * colored, and only once |Δ| exceeds FORCE_DELTA_THRESHOLD_N. */
export function absoluteDeltaTone(
  metric: MetricDef,
  base: number | null,
  value: number | null,
): DeltaTone {
  const delta = absoluteDelta(base, value);
  if (delta === null || base === null || value === null) return null;
  if (metric.unit !== "N" || Math.abs(delta) <= FORCE_DELTA_THRESHOLD_N) return null;
  return directionTone(metric, base, value);
}

/** Tone for a percent delta: any nonzero change -- except on force
 * metrics, where it follows the raw delta's tone, so a big-looking % on a
 * tiny force (e.g. 0.5 N -> 1 N = +100%) stays uncolored unless the raw
 * delta also clears FORCE_DELTA_THRESHOLD_N. */
export function percentDeltaTone(
  metric: MetricDef,
  base: number | null,
  value: number | null,
): DeltaTone {
  const pct = percentDelta(base, value);
  if (pct === null || base === null || value === null) return null;
  if (metric.unit === "N") return absoluteDeltaTone(metric, base, value);
  return directionTone(metric, base, value);
}
