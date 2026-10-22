export type SliceAxis = "X" | "Y" | "Z";

export interface Slice {
  url: string;
  name: string;
  axis: SliceAxis;
  position: number;
}

/** Velocity section exports, in every naming scheme export_scenes.java has
 * used (see docs/PostDotZip_FileNames.txt):
 *   current:  Velocity_X_0.30.png, Velocity_X-0.90.png  (axis then "_" or "-")
 *   older:    x__1.5.png, x_0.0.png, y__0.png, y_-0.55.png  (bare axis; "__"
 *             before a non-negative position, "_-" before a negative one)
 * Anything else -- Velocity_sweep.png, Wall_Y_.png, CP_*, WSS_* -- is not a
 * slice. Both schemes yield the same numbers (0.30 and 0.3 are equal), so
 * sims from different versions line up on one roller. */
const VELOCITY_SLICE = /^(?:Velocity_)?([XYZ])(?:__?|(?=-))(-?\d+(?:\.\d+)?)\.png$/i;

export function parseVelocitySlice(name: string): { axis: SliceAxis; position: number } | null {
  const match = name.match(VELOCITY_SLICE);
  if (!match) return null;
  // Number("-0") is -0, which Set and === treat as 0 anyway; normalise for display.
  const position = Number(match[2]) || 0;
  return { axis: match[1].toUpperCase() as SliceAxis, position };
}

/** The Velocity slices among a sim's scene images, sorted by axis then
 * position. Images whose Drive name hasn't resolved (null) are skipped. */
export function velocitySlices(urls: string[], names: Record<string, string | null>): Slice[] {
  const slices: Slice[] = [];
  for (const url of urls) {
    const name = names[url];
    const parsed = name ? parseVelocitySlice(name) : null;
    if (name && parsed) slices.push({ url, name, ...parsed });
  }
  return slices.sort((a, b) => a.axis.localeCompare(b.axis) || a.position - b.position);
}

/** Sorted, de-duplicated positions on one axis across several sims, so a
 * single roller position can drive every sim's panel. */
export function slicePositions(sliceSets: Slice[][], axis: SliceAxis): number[] {
  const positions = new Set<number>();
  for (const slices of sliceSets) {
    for (const s of slices) if (s.axis === axis) positions.add(s.position);
  }
  return [...positions].sort((a, b) => a - b);
}

export function formatSlicePosition(axis: SliceAxis, position: number): string {
  return `${axis} = ${position.toFixed(2)}`;
}
