/** The processed presentation-grid sweep a sim's `field_data_refs` links to:
 * `<job>_fields.json`, written by ingestion/parsers/field_export_parser.py.
 * Each station is an x-normal plane of grid points; values are base64
 * little-endian float32, row-major over (u, v), NaN where STAR exported no
 * point (inside a solid). u runs origin -> point1, v runs origin -> point2,
 * both as (y, z) pairs. */
export interface FieldVariable {
  key: string;
  name: string;
  unit: string;
}

export interface FieldFileJson {
  version: number;
  job_name: string;
  normal_axis: "x";
  units: string;
  origin_yz: [number, number];
  point1_yz: [number, number];
  point2_yz: [number, number];
  counts: [number, number];
  stations: number[];
  missing_stations: number[];
  variables: FieldVariable[];
  /** variable key -> one base64 array per entry in `stations`. */
  data: Record<string, string[]>;
}

export interface FieldFile extends Omit<FieldFileJson, "data"> {
  data: Record<string, Float32Array[]>;
}

export function parseFieldFile(json: FieldFileJson): FieldFile {
  if (json.version !== 1) throw new Error(`Unsupported field file version ${json.version}`);
  if (json.normal_axis !== "x") throw new Error(`Unsupported field normal axis ${json.normal_axis}`);
  const [nu, nv] = json.counts;
  const data: Record<string, Float32Array[]> = {};
  for (const [key, perStation] of Object.entries(json.data)) {
    data[key] = perStation.map((b64, i) => {
      const values = decodeFloat32(b64);
      if (values.length !== nu * nv) {
        throw new Error(`${key} at x = ${json.stations[i]} has ${values.length} values, expected ${nu * nv}`);
      }
      return values;
    });
  }
  return { ...json, data };
}

export function decodeFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const view = new DataView(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) view.setUint8(i, bin.charCodeAt(i));
  const out = new Float32Array(bin.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

const COORD_TOLERANCE = 1e-9;
const STATION_TOLERANCE = 1e-6;

/** Two files can be diffed cell by cell only on the identical grid. */
export function sameGrid(a: FieldFile, b: FieldFile): boolean {
  const eq = (p: number[], q: number[]) =>
    p.length === q.length && p.every((v, i) => Math.abs(v - q[i]) < COORD_TOLERANCE);
  return (
    eq(a.origin_yz, b.origin_yz) &&
    eq(a.point1_yz, b.point1_yz) &&
    eq(a.point2_yz, b.point2_yz) &&
    eq(a.counts, b.counts)
  );
}

/** Stations (x, m) present in both files, ascending. */
export function commonStations(a: FieldFile, b: FieldFile): number[] {
  return a.stations
    .filter((x) => stationIndex(b, x) >= 0)
    .sort((p, q) => p - q);
}

export function stationIndex(f: FieldFile, x: number): number {
  return f.stations.findIndex((s) => Math.abs(s - x) < STATION_TOLERANCE);
}

/** Variables present in both files, in `a`'s order. */
export function commonVariables(a: FieldFile, b: FieldFile): FieldVariable[] {
  return a.variables.filter((v) => b.variables.some((w) => w.key === v.key));
}

/** Grid point (iu, iv) -> (y, z) in metres. */
export function cellYZ(f: FieldFile, iu: number, iv: number): [number, number] {
  const [nu, nv] = f.counts;
  const fu = iu / (nu - 1);
  const fv = iv / (nv - 1);
  return [
    f.origin_yz[0] + fu * (f.point1_yz[0] - f.origin_yz[0]) + fv * (f.point2_yz[0] - f.origin_yz[0]),
    f.origin_yz[1] + fu * (f.point1_yz[1] - f.origin_yz[1]) + fv * (f.point2_yz[1] - f.origin_yz[1]),
  ];
}

/** Per cell: "both" = solid in both sims, "one" = data in only one
 * (geometry differs), null = compared. */
export type CellMask = "both" | "one" | null;

export interface FieldDelta {
  /** B - A, NaN wherever either side has no data. */
  delta: Float32Array;
  mask: CellMask[];
}

export function fieldDelta(a: Float32Array, b: Float32Array): FieldDelta {
  if (a.length !== b.length) throw new Error("Field arrays differ in length");
  const delta = new Float32Array(a.length);
  const mask: CellMask[] = new Array(a.length).fill(null);
  for (let i = 0; i < a.length; i++) {
    const na = Number.isNaN(a[i]);
    const nb = Number.isNaN(b[i]);
    delta[i] = na || nb ? NaN : b[i] - a[i];
    if (na && nb) mask[i] = "both";
    else if (na || nb) mask[i] = "one";
  }
  return { delta, mask };
}

export interface CellBox {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/** Smallest (u, v) box holding every cell with data in any of `arrays`,
 * grown by `margin` cells; the whole grid when there's no data at all. The
 * export only has fluid on one side of the symmetry plane and above the
 * ground, so this keeps the empty three quarters out of the view. */
export function dataBox(counts: [number, number], arrays: Float32Array[], margin = 1): CellBox {
  const [nu, nv] = counts;
  let u0 = nu, u1 = -1, v0 = nv, v1 = -1;
  for (let iu = 0; iu < nu; iu++) {
    for (let iv = 0; iv < nv; iv++) {
      if (arrays.some((arr) => !Number.isNaN(arr[iu * nv + iv]))) {
        u0 = Math.min(u0, iu);
        u1 = Math.max(u1, iu);
        v0 = Math.min(v0, iv);
        v1 = Math.max(v1, iv);
      }
    }
  }
  if (u1 < 0) return { u0: 0, u1: nu - 1, v0: 0, v1: nv - 1 };
  return {
    u0: Math.max(0, u0 - margin),
    u1: Math.min(nu - 1, u1 + margin),
    v0: Math.max(0, v0 - margin),
    v1: Math.min(nv - 1, v1 + margin),
  };
}

function finiteSorted(arrays: ArrayLike<number>[], map: (v: number) => number = (v) => v): number[] {
  const out: number[] = [];
  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i++) if (!Number.isNaN(arr[i])) out.push(map(arr[i]));
  }
  return out.sort((p, q) => p - q);
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.round(p * (sorted.length - 1))];
}

/** One colour range shared by A and B (1st-99th percentile of both), so
 * equal colours mean equal values. Null when neither has data. */
export function sharedRange(a: Float32Array, b: Float32Array): [number, number] | null {
  const values = finiteSorted([a, b]);
  if (!values.length) return null;
  const lo = percentile(values, 0.01);
  const hi = percentile(values, 0.99);
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
}

/** Half-width of the symmetric Δ colour range: the 98th percentile of |Δ|
 * so a few outlier cells don't wash out the rest; never 0. */
export function deltaRange(delta: Float32Array): number {
  const abs = finiteSorted([delta], Math.abs);
  if (!abs.length) return 1;
  return percentile(abs, 0.98) || abs[abs.length - 1] || 1;
}

/** Where a 2560 x 1440 Velocity_X slice image sits in (y, z), so the maps
 * can be laid over it. Estimated by eye from DY_FC_Mesh30mm_Straight_20261003
 * at x = 0.40 (car width and ground line): the slice camera is fixed in the
 * sim template, so one placement fits every station and run. Approximate --
 * exact values would come from each scene's camera (focal point and
 * parallel scale), which export_scenes.java doesn't record yet. */
export const SLICE_IMAGE_PLACEMENT = {
  /** Image width and height in metres. */
  width: 2560 * 0.00126,
  height: 1440 * 0.00126,
  /** Fraction of the width from the left edge where y = 0. */
  yZeroAt: 1280 / 2560,
  /** Fraction of the height from the top edge where z = 0 (the ground). */
  zZeroAt: 1143 / 1440,
};
