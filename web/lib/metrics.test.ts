import { describe, expect, it } from "vitest";
import { comparableValue, compareMetric, downforceToDragRatio, METRIC_MAP } from "@/lib/metrics";
import { makeRow } from "@/lib/__fixtures__/sim-row";

describe("comparableValue", () => {
  it("is null for a null input", () => {
    expect(comparableValue(null, "lower")).toBeNull();
  });

  it("takes the magnitude for higher-abs metrics", () => {
    expect(comparableValue(-190, "higher-abs")).toBe(190);
  });

  it("passes through the raw value for lower/neutral metrics", () => {
    expect(comparableValue(-190, "lower")).toBe(-190);
    expect(comparableValue(-190, "neutral")).toBe(-190);
  });
});

describe("compareMetric", () => {
  it("is 0 (incomparable) when either side is null", () => {
    expect(compareMetric(null, 5, "lower")).toBe(0);
    expect(compareMetric(5, null, "lower")).toBe(0);
  });

  it("is always 0 for neutral metrics", () => {
    expect(compareMetric(1, 100, "neutral")).toBe(0);
  });

  it("for higher-abs, more negative downforce beats less negative", () => {
    // total_df: -190 (more downforce) vs -50 (less downforce)
    expect(compareMetric(-190, -50, "higher-abs")).toBe(1);
    expect(compareMetric(-50, -190, "higher-abs")).toBe(-1);
  });

  it("for lower, a smaller value is better", () => {
    expect(compareMetric(40, 90, "lower")).toBe(1);
    expect(compareMetric(90, 40, "lower")).toBe(-1);
  });

  it("is 0 for equal comparable values", () => {
    expect(compareMetric(-100, 100, "higher-abs")).toBe(0);
  });
});

describe("METRIC_MAP", () => {
  it("has an entry for every metric key with a label and unit", () => {
    for (const key of Object.keys(METRIC_MAP) as (keyof typeof METRIC_MAP)[]) {
      expect(METRIC_MAP[key].label).toBeTruthy();
      expect(METRIC_MAP[key].better).toMatch(/^(higher-abs|lower|neutral)$/);
    }
  });
});

describe("downforceToDragRatio", () => {
  it("is null when total_drag is 0 (avoids divide-by-zero)", () => {
    expect(downforceToDragRatio(makeRow({ total_df: -100, total_drag: 0 }))).toBeNull();
  });

  it("is null when either value is missing", () => {
    expect(downforceToDragRatio(makeRow({ total_df: null }))).toBeNull();
  });

  it("computes abs(total_df) / total_drag", () => {
    expect(downforceToDragRatio(makeRow({ total_df: -190, total_drag: 95 }))).toBeCloseTo(2, 5);
  });
});
