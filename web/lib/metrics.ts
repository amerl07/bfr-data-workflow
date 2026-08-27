import type { NumericMetricKey, SimRow } from "./types";

export type BetterDirection = "higher-abs" | "lower" | "neutral";

export interface MetricDef {
  key: NumericMetricKey;
  label: string;
  unit: string;
  group: "downforce" | "drag" | "area-coefficient" | "cop" | "radiator" | "mesh";
  better: BetterDirection;
}

/** Single source of truth for every numeric metric: label/unit for display,
 * and which direction counts as "better" for Compare highlighting and
 * Analytics leaderboards. DF metrics use magnitude (`Math.abs`) per the
 * spec's own `abs(full_car_df) / full_car_drag` ratio convention — this
 * dataset's sign convention has downforce as negative. CoP/area/coefficient/
 * radiator/cell_count figures are positional/setup values, not performance,
 * so they're never highlighted (`better: "neutral"`).
 *
 * Groups mirror the panels laid out in types.ts's SimRow (2026-08-27):
 * downforce / drag / area-coefficient / cop / radiator / mesh. */
export const METRICS: MetricDef[] = [
  // Downforce panel
  { key: "full_car_df", label: "Full Car DF", unit: "N", group: "downforce", better: "higher-abs" },
  { key: "total_aero_df", label: "Total Aero DF", unit: "N", group: "downforce", better: "higher-abs" },
  { key: "body_df", label: "Body DF", unit: "N", group: "downforce", better: "higher-abs" },
  { key: "fw_df", label: "Front Wing DF", unit: "N", group: "downforce", better: "higher-abs" },
  { key: "rw_df", label: "Rear Wing DF", unit: "N", group: "downforce", better: "higher-abs" },
  { key: "ut_df", label: "Undertray DF", unit: "N", group: "downforce", better: "higher-abs" },
  { key: "wheel_df", label: "Wheel DF", unit: "N", group: "downforce", better: "higher-abs" },
  { key: "endplate_df", label: "Endplate DF", unit: "N", group: "downforce", better: "higher-abs" },
  { key: "swan_neck_df", label: "Swan Neck DF", unit: "N", group: "downforce", better: "higher-abs" },
  { key: "carbon_rod_df", label: "Carbon Rod DF", unit: "N", group: "downforce", better: "higher-abs" },
  { key: "EL4_df", label: "EL4 DF", unit: "N", group: "downforce", better: "higher-abs" },
  { key: "EL5_df", label: "EL5 DF", unit: "N", group: "downforce", better: "higher-abs" },
  { key: "EL6_df", label: "EL6 DF", unit: "N", group: "downforce", better: "higher-abs" },
  { key: "EL7_df", label: "EL7 DF", unit: "N", group: "downforce", better: "higher-abs" },

  // Drag panel
  { key: "full_car_drag", label: "Full Car Drag", unit: "N", group: "drag", better: "lower" },
  { key: "body_drag", label: "Body Drag", unit: "N", group: "drag", better: "lower" },
  { key: "fw_drag", label: "Front Wing Drag", unit: "N", group: "drag", better: "lower" },
  { key: "rw_drag", label: "Rear Wing Drag", unit: "N", group: "drag", better: "lower" },
  { key: "ut_drag", label: "Undertray Drag", unit: "N", group: "drag", better: "lower" },
  { key: "wheel_drag", label: "Wheel Drag", unit: "N", group: "drag", better: "lower" },
  { key: "endplate_drag", label: "Endplate Drag", unit: "N", group: "drag", better: "lower" },
  { key: "swan_neck_dragf", label: "Swan Neck Drag", unit: "N", group: "drag", better: "lower" },
  { key: "carbon_rod_drag", label: "Carbon Rod Drag", unit: "N", group: "drag", better: "lower" },
  { key: "EL4_drag", label: "EL4 Drag", unit: "N", group: "drag", better: "lower" },
  { key: "EL5_drag", label: "EL5 Drag", unit: "N", group: "drag", better: "lower" },
  { key: "EL6_drag", label: "EL6 Drag", unit: "N", group: "drag", better: "lower" },
  { key: "EL7_drag", label: "EL7 Drag", unit: "N", group: "drag", better: "lower" },

  // Area and Coefficients panel
  { key: "frontal_area", label: "Frontal Area", unit: "m^2", group: "area-coefficient", better: "neutral" },
  { key: "RW_area", label: "RW Area", unit: "m^2", group: "area-coefficient", better: "neutral" },
  { key: "FW_area", label: "FW Area", unit: "m^2", group: "area-coefficient", better: "neutral" },
  { key: "UT_area", label: "UT Area", unit: "m^2", group: "area-coefficient", better: "neutral" },
  { key: "ClA", label: "ClA", unit: "", group: "area-coefficient", better: "neutral" },
  { key: "CdA", label: "CdA", unit: "", group: "area-coefficient", better: "neutral" },

  // Center of Pressure panel
  { key: "full_car_CoP", label: "Full Car CoP", unit: "%", group: "cop", better: "neutral" },
  { key: "full_car_CoP_meters", label: "Full Car CoP", unit: "m", group: "cop", better: "neutral" },
  { key: "UT_CoP_meters", label: "UT CoP", unit: "m", group: "cop", better: "neutral" },
  { key: "RW_CoP_meters", label: "RW CoP", unit: "m", group: "cop", better: "neutral" },

  // Radiator panel
  { key: "radiator_MFR", label: "Radiator MFR", unit: "kg/s", group: "radiator", better: "neutral" },
  { key: "inlet_MF_averaged_pressure", label: "Inlet MFA Pressure", unit: "Pa", group: "radiator", better: "neutral" },
  { key: "outlet_MF_averaged_pressure", label: "Outlet MFA Pressure", unit: "Pa", group: "radiator", better: "neutral" },
  { key: "pressure_drop", label: "Pressure Drop", unit: "", group: "radiator", better: "neutral" },

  // Sim Metadata panel
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

/** Downforce-to-drag ratio leaderboard metric, per spec: abs(full_car_df) / full_car_drag. */
export function downforceToDragRatio(row: SimRow): number | null {
  if (row.full_car_df === null || row.full_car_drag === null || row.full_car_drag === 0) return null;
  return Math.abs(row.full_car_df) / row.full_car_drag;
}
