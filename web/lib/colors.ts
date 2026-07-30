/** Categorical palette (validated: `dataviz` skill's reference palette).
 * Fixed hue order — never cycled arbitrarily, only ever sliced from the front. */
export const CATEGORICAL_LIGHT = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

export const CATEGORICAL_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
];

/** Scatter/bubble plots compare every point against every other (all-pairs),
 * not just neighbors — the palette only validates all-pairs CVD separation
 * for its first 3 slots (see dataviz skill's palette reference). Beyond
 * that, categories fold into a neutral "Other" bucket rather than reusing
 * slots 4-8, which fail the all-pairs floor. */
export const SCATTER_SAFE_COUNT = 3;
export const OTHER_COLOR_LIGHT = "#898781";
export const OTHER_COLOR_DARK = "#898781";
export const OTHER_LABEL = "Other";

export function categoricalColor(index: number, mode: "light" | "dark" = "light"): string {
  const palette = mode === "dark" ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  return palette[index % palette.length];
}

/** Maps a set of category values to colors, capping direct color assignment
 * at SCATTER_SAFE_COUNT (by descending frequency) and folding the rest into
 * "Other" — for use in all-pairs contexts (scatter). */
export function buildScatterColorScale(
  values: string[],
  mode: "light" | "dark" = "light",
): { colorOf: (v: string) => string; legend: { label: string; color: string }[] } {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, SCATTER_SAFE_COUNT).map(([v]) => v);

  const colorMap = new Map<string, string>();
  top.forEach((v, i) => colorMap.set(v, categoricalColor(i, mode)));

  const otherColor = mode === "dark" ? OTHER_COLOR_DARK : OTHER_COLOR_LIGHT;

  const legend = top.map((v, i) => ({ label: v, color: categoricalColor(i, mode) }));
  if (ranked.length > top.length) legend.push({ label: OTHER_LABEL, color: otherColor });

  return {
    colorOf: (v: string) => colorMap.get(v) ?? otherColor,
    legend,
  };
}

const DIVERGING_NEUTRAL = { light: "#f0efec", dark: "#383835" };
const DIVERGING_NEGATIVE = "#2a78d6"; // blue
const DIVERGING_POSITIVE = "#e34948"; // red

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Cheap relative-luminance heuristic to pick readable text over a
 * computed background swatch (correlation heatmap cells). */
export function textColorForBg(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0b0b0b" : "#ffffff";
}

/** Diverging color for a value in [-1, 1] (e.g. a correlation coefficient):
 * neutral gray at 0, sweeping to blue (negative) or red (positive) at the
 * extremes — the palette's documented diverging pair. */
export function divergingColor(value: number, mode: "light" | "dark" = "light"): string {
  const t = Math.max(-1, Math.min(1, value));
  const neutral = hexToRgb(DIVERGING_NEUTRAL[mode]);
  const pole = hexToRgb(t < 0 ? DIVERGING_NEGATIVE : DIVERGING_POSITIVE);
  const strength = Math.abs(t);
  return rgbToHex([
    lerp(neutral[0], pole[0], strength),
    lerp(neutral[1], pole[1], strength),
    lerp(neutral[2], pole[2], strength),
  ]);
}
