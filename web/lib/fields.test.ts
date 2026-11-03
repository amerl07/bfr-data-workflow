import { describe, expect, it } from "vitest";
import {
  cellYZ,
  commonStations,
  commonVariables,
  dataBox,
  decodeFloat32,
  deltaRange,
  fieldDelta,
  parseFieldFile,
  sameGrid,
  sharedRange,
  stationIndex,
  type FieldFileJson,
} from "@/lib/fields";

function encode(values: number[]): string {
  const view = new DataView(new ArrayBuffer(values.length * 4));
  values.forEach((v, i) => view.setFloat32(i * 4, v, true));
  let bin = "";
  for (let i = 0; i < view.byteLength; i++) bin += String.fromCharCode(view.getUint8(i));
  return btoa(bin);
}

// A 3 x 3 grid over y = -0.6..0, z = 1.2..0 (u runs z down, v runs y up),
// like the real export's corners.
function fieldJson(overrides: Partial<FieldFileJson> = {}, values?: Record<string, number[][]>): FieldFileJson {
  const vals = values ?? { velocity_magnitude: [[1, 2, 3, 4, 5, 6, 7, 8, 9]] };
  return {
    version: 1,
    job_name: "YL_FC_Test_Straightline_20261101",
    normal_axis: "x",
    units: "m",
    origin_yz: [-0.6, 1.2],
    point1_yz: [-0.6, 0],
    point2_yz: [0, 1.2],
    counts: [3, 3],
    stations: [0.1],
    missing_stations: [],
    variables: Object.keys(vals).map((key) => ({ key, name: key, unit: "m/s" })),
    data: Object.fromEntries(Object.entries(vals).map(([k, per]) => [k, per.map(encode)])),
    ...overrides,
  };
}

describe("decodeFloat32", () => {
  it("round-trips little-endian float32, NaN included", () => {
    const out = decodeFloat32(encode([1.5, -2, NaN]));
    expect(out[0]).toBe(1.5);
    expect(out[1]).toBe(-2);
    expect(Number.isNaN(out[2])).toBe(true);
  });
});

describe("parseFieldFile", () => {
  it("decodes every station of every variable", () => {
    const f = parseFieldFile(fieldJson());
    expect(Array.from(f.data.velocity_magnitude[0])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("rejects an array that doesn't fill the grid", () => {
    expect(() => parseFieldFile(fieldJson({}, { velocity_magnitude: [[1, 2]] }))).toThrow(/expected 9/);
  });

  it("rejects an unknown version", () => {
    expect(() => parseFieldFile(fieldJson({ version: 2 }))).toThrow(/version/);
  });
});

describe("grid and station matching", () => {
  it("compares grids by corners and counts", () => {
    const a = parseFieldFile(fieldJson());
    expect(sameGrid(a, parseFieldFile(fieldJson()))).toBe(true);
    expect(sameGrid(a, parseFieldFile(fieldJson({ point2_yz: [0.1, 1.2] })))).toBe(false);
  });

  it("finds stations both files have, within float noise", () => {
    const a = parseFieldFile(
      fieldJson({ stations: [0.1, 0.15, 0.2] }, { velocity_magnitude: [[...Array(9).fill(0)], [...Array(9).fill(0)], [...Array(9).fill(0)]] }),
    );
    const b = parseFieldFile(
      fieldJson({ stations: [0.2, 0.1 + 1e-9] }, { velocity_magnitude: [[...Array(9).fill(0)], [...Array(9).fill(0)]] }),
    );
    expect(commonStations(a, b)).toEqual([0.1, 0.2]);
    expect(stationIndex(b, 0.1)).toBe(1);
    expect(stationIndex(b, 0.15)).toBe(-1);
  });

  it("keeps only variables both files have", () => {
    const a = parseFieldFile(fieldJson({}, { velocity_magnitude: [Array(9).fill(0)], pressure_coefficient: [Array(9).fill(0)] }));
    const b = parseFieldFile(fieldJson({}, { pressure_coefficient: [Array(9).fill(0)] }));
    expect(commonVariables(a, b).map((v) => v.key)).toEqual(["pressure_coefficient"]);
  });
});

describe("cellYZ", () => {
  it("maps u along origin->point1 and v along origin->point2", () => {
    const f = parseFieldFile(fieldJson());
    expect(cellYZ(f, 0, 0)).toEqual([-0.6, 1.2]);
    expect(cellYZ(f, 2, 0)).toEqual([-0.6, 0]);
    expect(cellYZ(f, 0, 2)).toEqual([0, 1.2]);
    expect(cellYZ(f, 1, 1)).toEqual([-0.3, 0.6]);
  });
});

describe("fieldDelta", () => {
  it("diffs B - A and classifies missing cells", () => {
    const a = new Float32Array([1, NaN, NaN, 4]);
    const b = new Float32Array([3, 2, NaN, 1]);
    const { delta, mask } = fieldDelta(a, b);
    expect(delta[0]).toBe(2);
    expect(delta[3]).toBe(-3);
    expect(Number.isNaN(delta[1])).toBe(true);
    expect(mask).toEqual([null, "one", "both", null]);
  });
});

describe("dataBox", () => {
  it("bounds the cells with data in either array, with a margin", () => {
    const n = NaN;
    // 4 x 4, data only at (1, 2) in a and (2, 2) in b.
    const a = new Float32Array([n, n, n, n, n, n, 1, n, n, n, n, n, n, n, n, n]);
    const b = new Float32Array([n, n, n, n, n, n, n, n, n, n, 1, n, n, n, n, n]);
    expect(dataBox([4, 4], [a, b], 0)).toEqual({ u0: 1, u1: 2, v0: 2, v1: 2 });
    expect(dataBox([4, 4], [a, b], 1)).toEqual({ u0: 0, u1: 3, v0: 1, v1: 3 });
  });

  it("falls back to the whole grid when nothing has data", () => {
    expect(dataBox([2, 3], [new Float32Array(6).fill(NaN)])).toEqual({ u0: 0, u1: 1, v0: 0, v1: 2 });
  });
});

describe("colour ranges", () => {
  it("shares one A/B range and ignores NaN", () => {
    const a = new Float32Array([0, 10, NaN]);
    const b = new Float32Array([5, 20, NaN]);
    expect(sharedRange(a, b)).toEqual([0, 20]);
    expect(sharedRange(new Float32Array([NaN]), new Float32Array([NaN]))).toBeNull();
  });

  it("widens a flat range so the colour scale has extent", () => {
    expect(sharedRange(new Float32Array([3]), new Float32Array([3]))).toEqual([2, 4]);
  });

  it("uses the 98th percentile of |Δ| and is never 0", () => {
    const d = new Float32Array(100).map((_, i) => (i % 2 ? -i : i));
    expect(deltaRange(d)).toBe(97);
    expect(deltaRange(new Float32Array([0, 0]))).toBe(1);
    expect(deltaRange(new Float32Array([NaN]))).toBe(1);
  });
});
