import { describe, expect, it } from "vitest";
import { countBy, histogram, leaderboard, mean, pearsonCorrelation } from "@/lib/stats";
import { makeRow } from "@/lib/__fixtures__/sim-row";

describe("mean", () => {
  it("is null for an empty array", () => {
    expect(mean([])).toBeNull();
  });

  it("averages values", () => {
    expect(mean([1, 2, 3])).toBe(2);
  });
});

describe("pearsonCorrelation", () => {
  it("is null with zero pairs", () => {
    expect(pearsonCorrelation([], [])).toBeNull();
  });

  it("is null with only one complete pair (N=1)", () => {
    expect(pearsonCorrelation([1], [2])).toBeNull();
  });

  it("is null when a series has no variance", () => {
    expect(pearsonCorrelation([1, 1, 1], [1, 2, 3])).toBeNull();
  });

  it("drops pairs where either value is null (pairwise-complete)", () => {
    const xs = [1, 2, null, 4];
    const ys = [1, 2, 3, null];
    // Only (1,1) and (2,2) are complete pairs -> perfect correlation, not null.
    expect(pearsonCorrelation(xs, ys)).toBeCloseTo(1, 5);
  });

  it("is 1 for a perfectly positively correlated series", () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 5);
  });

  it("is -1 for a perfectly negatively correlated series", () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 5);
  });
});

describe("histogram", () => {
  it("returns [] for no values", () => {
    expect(histogram([])).toEqual([]);
  });

  it("collapses to a single bucket when all values are equal", () => {
    const buckets = histogram([5, 5, 5]);
    expect(buckets).toEqual([{ min: 5, max: 5, count: 3 }]);
  });

  it("buckets a spread of values and every value lands somewhere", () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const buckets = histogram(values, 5);
    expect(buckets).toHaveLength(5);
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(values.length);
  });
});

describe("countBy", () => {
  it("returns [] for no items", () => {
    expect(countBy([], (r: { x: string }) => r.x)).toEqual([]);
  });

  it("counts occurrences and coalesces blanks to an em dash", () => {
    const result = countBy([{ x: "a" }, { x: "a" }, { x: "" }], (r) => r.x);
    expect(result).toContainEqual({ label: "a", count: 2 });
    expect(result).toContainEqual({ label: "—", count: 1 });
  });
});

describe("leaderboard", () => {
  it("returns [] for no rows", () => {
    expect(leaderboard([], () => 1, "desc")).toEqual([]);
  });

  it("excludes rows with a null value", () => {
    const rows = [makeRow({ total_df: -100 }), makeRow({ total_df: null })];
    const result = leaderboard(rows, (r) => r.total_df, "desc");
    expect(result).toHaveLength(1);
  });

  it("orders desc/asc and respects the limit", () => {
    const rows = [
      makeRow({ total_df: -50 }),
      makeRow({ total_df: -200 }),
      makeRow({ total_df: -100 }),
    ];
    const desc = leaderboard(rows, (r) => r.total_df, "desc", 2);
    expect(desc.map((e) => e.value)).toEqual([-50, -100]);
    const asc = leaderboard(rows, (r) => r.total_df, "asc", 1);
    expect(asc.map((e) => e.value)).toEqual([-200]);
  });
});
