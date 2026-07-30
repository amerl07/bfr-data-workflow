import type { NumericMetricKey, SimRow } from "./types";

export type BetterDirection = "higher-abs" | "lower" | "neutral";

export interface MetricDef {
  key: NumericMetricKey;
  label: string;
  unit: string;
  group: "aero-force" | "drag" | "cop" | "mesh";
  better: BetterDirection;
}

/** Single source of truth for every numeric metric: label/unit for display,
 * and which direction counts as "better" for Compare highlighting and
 * Analytics leaderboards. DF metrics use magnitude (`Math.abs`) per the
 * spec's own `abs(total_df) / total_drag` ratio convention — this dataset's
 * sign convention has downforce as negative. CoP/CoP_meters/cell_count are
 * positional/mesh-size, not performance, so they're never highlighted. */
export const METRICS: MetricDef[] = [
  { key: "body_df", label: "Body DF", unit: "N", group: "aero-force", better: "higher-abs" },
  { key: "fw_df", label: "Front Wing DF", unit: "N", group: "aero-force", better: "higher-abs" },
  { key: "rw_df", label: "Rear Wing DF", unit: "N", group: "aero-force", better: "higher-abs" },
  { key: "ut_df", label: "Undertray DF", unit: "N", group: "aero-force", better: "higher-abs" },
  { key: "wheel_df", label: "Wheel DF", unit: "N", group: "aero-force", better: "higher-abs" },
  { key: "whisker_df", label: "Whisker DF", unit: "N", group: "aero-force", better: "higher-abs" },
  { key: "total_aero_df", label: "Total Aero DF", unit: "N", group: "aero-force", better: "higher-abs" },
  { key: "total_df", label: "Total DF", unit: "N", group: "aero-force", better: "higher-abs" },
  { key: "rw_drag", label: "RW Drag", unit: "N", group: "drag", better: "lower" },
  { key: "total_drag", label: "Total Drag", unit: "N", group: "drag", better: "lower" },
  { key: "CoP", label: "CoP", unit: "%", group: "cop", better: "neutral" },
  { key: "CoP_meters", label: "CoP", unit: "m", group: "cop", better: "neutral" },
  { key: "cell_count", label: "Cell Count", unit: "", group: "mesh", better: "neutral" },
];

export const METRIC_MAP: Record<NumericMetricKey, MetricDef> = Object.fromEntries(
  METRICS.map((m) => [m.key, m]),
) as Record<NumericMetricKey, MetricDef>;

export function metricValue(row: SimRow, key: NumericMetricKey): number | null {
  return row[key];
}

/** Magnitude used for "better" comparisons on higher-abs metrics; raw value otherwise. */
export function comparableValue(value: number | null, better: BetterDirection): number | null {
  if (value === null) return null;
  return better === "higher-abs" ? Math.abs(value) : value;
}

/** 1 if `a` is strictly better than `b`, -1 if worse, 0 if equal/neutral/incomparable. */
export function compareMetric(
  a: number | null,
  b: number | null,
  better: BetterDirection,
): -1 | 0 | 1 {
  if (better === "neutral" || a === null || b === null) return 0;
  const ca = comparableValue(a, better)!;
  const cb = comparableValue(b, better)!;
  if (ca === cb) return 0;
  if (better === "lower") return ca < cb ? 1 : -1;
  return ca > cb ? 1 : -1;
}

/** Downforce-to-drag ratio leaderboard metric, per spec: abs(total_df) / total_drag. */
export function downforceToDragRatio(row: SimRow): number | null {
  if (row.total_df === null || row.total_drag === null || row.total_drag === 0) return null;
  return Math.abs(row.total_df) / row.total_drag;
}
