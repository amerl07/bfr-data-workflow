import { describe, expect, it } from "vitest";
import { getBatchSiblings, formatSweptRange } from "@/lib/batch";
import { makeRow } from "@/lib/__fixtures__/sim-row";

describe("getBatchSiblings", () => {
  it("returns [] when source_drive_folder is blank", () => {
    const row = makeRow({ source_drive_folder: "" });
    expect(getBatchSiblings(row, [row])).toEqual([]);
  });

  it("returns rows sharing source_drive_folder, sorted by swept_value ascending", () => {
    const a = makeRow({ job_name: "A", source_drive_folder: "F1", swept_value: 35 });
    const b = makeRow({ job_name: "B", source_drive_folder: "F1", swept_value: 30 });
    const other = makeRow({ job_name: "OTHER", source_drive_folder: "F2", swept_value: 10 });

    expect(getBatchSiblings(a, [a, b, other]).map((r) => r.job_name)).toEqual(["B", "A"]);
  });

  it("sorts rows with no swept_value last", () => {
    const a = makeRow({ job_name: "A", source_drive_folder: "F1", swept_value: 30 });
    const noValue = makeRow({ job_name: "NOVALUE", source_drive_folder: "F1", swept_value: null });

    expect(getBatchSiblings(a, [a, noValue]).map((r) => r.job_name)).toEqual(["A", "NOVALUE"]);
  });
});

describe("formatSweptRange", () => {
  it("returns '' when fewer than two rows have a numeric swept_value", () => {
    expect(formatSweptRange([makeRow({ swept_value: 30, swept_value_unit: "mm" })])).toBe("");
    expect(formatSweptRange([])).toBe("");
  });

  it("formats min-max with the shared unit", () => {
    const rows = [
      makeRow({ swept_value: 30, swept_value_unit: "mm" }),
      makeRow({ swept_value: 45, swept_value_unit: "mm" }),
      makeRow({ swept_value: 35, swept_value_unit: "mm" }),
    ];
    expect(formatSweptRange(rows)).toBe("30-45mm");
  });
});
