import { describe, expect, it } from "vitest";
import {
  absoluteDeltaTone,
  buildCompareParams,
  parseCompareParams,
  percentDeltaTone,
} from "@/lib/compare";
import { METRIC_MAP } from "@/lib/metrics";

describe("parseCompareParams", () => {
  it("reads repeated sim params and an explicit base", () => {
    const p = new URLSearchParams("sim=A&sim=B&sim=C&base=B");
    expect(parseCompareParams(p)).toEqual({ sims: ["A", "B", "C"], base: "B" });
  });

  it("defaults the base to the first sim when missing or not selected", () => {
    expect(parseCompareParams(new URLSearchParams("sim=A&sim=B"))).toEqual({ sims: ["A", "B"], base: "A" });
    expect(parseCompareParams(new URLSearchParams("sim=A&sim=B&base=Z")).base).toBe("A");
  });

  it("falls back to legacy a/b params", () => {
    expect(parseCompareParams(new URLSearchParams("a=X&b=Y"))).toEqual({ sims: ["X", "Y"], base: "X" });
    expect(parseCompareParams(new URLSearchParams("a=X"))).toEqual({ sims: ["X"], base: "X" });
  });

  it("dedupes and handles empty", () => {
    expect(parseCompareParams(new URLSearchParams("sim=A&sim=A")).sims).toEqual(["A"]);
    expect(parseCompareParams(new URLSearchParams(""))).toEqual({ sims: [], base: null });
  });
});

describe("buildCompareParams", () => {
  it("round-trips, drops legacy params, and omits a default base", () => {
    const out = buildCompareParams(new URLSearchParams("a=X&b=Y&other=1"), { sims: ["A", "B"], base: "A" });
    expect(out.toString()).toBe("other=1&sim=A&sim=B");
    const withBase = buildCompareParams(new URLSearchParams(), { sims: ["A", "B"], base: "B" });
    expect(parseCompareParams(withBase)).toEqual({ sims: ["A", "B"], base: "B" });
  });
});

describe("absoluteDeltaTone", () => {
  const df = METRIC_MAP.full_car_df; // higher-abs, N
  const drag = METRIC_MAP.full_car_drag; // lower, N
  const cop = METRIC_MAP.full_car_CoP; // neutral, %

  it("ignores force deltas at or under 1.5 N", () => {
    expect(absoluteDeltaTone(drag, 50, 51.5)).toBeNull();
    expect(absoluteDeltaTone(drag, 50, 48.5)).toBeNull();
  });

  it("colors force deltas over 1.5 N by better direction", () => {
    expect(absoluteDeltaTone(drag, 50, 52)).toBe("worse");
    expect(absoluteDeltaTone(drag, 50, 48)).toBe("better");
    // DF is negative in this dataset: more negative = more downforce = better.
    expect(absoluteDeltaTone(df, -100, -105)).toBe("better");
    expect(absoluteDeltaTone(df, -100, -95)).toBe("worse");
  });

  it("never colors non-force raw deltas", () => {
    expect(absoluteDeltaTone(cop, 40, 60)).toBeNull();
  });

  it("is null when either side is missing", () => {
    expect(absoluteDeltaTone(drag, null, 60)).toBeNull();
    expect(absoluteDeltaTone(drag, 50, null)).toBeNull();
  });
});

describe("percentDeltaTone", () => {
  it("colors force metrics only when the raw delta is also colored (> 1.5 N)", () => {
    expect(percentDeltaTone(METRIC_MAP.full_car_drag, 50, 51)).toBeNull();
    expect(percentDeltaTone(METRIC_MAP.full_car_drag, 0.5, 1)).toBeNull(); // +100% but only 0.5 N
    expect(percentDeltaTone(METRIC_MAP.full_car_drag, 50, 52)).toBe("worse");
    expect(percentDeltaTone(METRIC_MAP.full_car_df, -100, -105)).toBe("better");
  });

  it("colors any nonzero change on non-force metrics, by better direction", () => {
    expect(percentDeltaTone(METRIC_MAP.full_car_CoP, 40, 40.1)).toBe("better");
  });

  it("colors neutral metrics by sign", () => {
    expect(percentDeltaTone(METRIC_MAP.full_car_CoP, 40, 41)).toBe("better");
    expect(percentDeltaTone(METRIC_MAP.full_car_CoP, 40, 39)).toBe("worse");
  });

  it("is null for no change or an undefined percent (base 0)", () => {
    expect(percentDeltaTone(METRIC_MAP.full_car_CoP, 40, 40)).toBeNull();
    expect(percentDeltaTone(METRIC_MAP.full_car_CoP, 0, 5)).toBeNull();
  });
});
