import { describe, expect, it } from "vitest";
import {
  applyFilters,
  dataBounds,
  distinctValues,
  EMPTY_FILTERS,
  filtersFromSearchParams,
  filtersToSearchParams,
  isFiltersEmpty,
} from "@/lib/filters";
import { makeRow } from "@/lib/__fixtures__/sim-row";

describe("applyFilters", () => {
  it("returns everything for empty rows", () => {
    expect(applyFilters([], EMPTY_FILTERS)).toEqual([]);
  });

  it("returns everything for empty filters with one row", () => {
    const row = makeRow();
    expect(applyFilters([row], EMPTY_FILTERS)).toEqual([row]);
  });

  it("filters by search on job_name and post_zip_name", () => {
    const a = makeRow({ job_name: "CD_UT_Outwash_Cornering_20260726" });
    const b = makeRow({ job_name: "AB_RW_Endplate_Pitch_20260101" });
    const result = applyFilters([a, b], { ...EMPTY_FILTERS, search: "outwash" });
    expect(result).toEqual([a]);
  });

  it("filters by multi-select component", () => {
    const a = makeRow({ component: "UT" });
    const b = makeRow({ component: "Rear Wing" });
    const result = applyFilters([a, b], { ...EMPTY_FILTERS, components: ["Rear Wing"] });
    expect(result).toEqual([b]);
  });

  it("excludes rows with null values when a range filter is active", () => {
    const withValue = makeRow({ total_df: -150 });
    const withoutValue = makeRow({ total_df: null });
    const result = applyFilters([withValue, withoutValue], {
      ...EMPTY_FILTERS,
      totalDfRange: [-200, -100],
    });
    expect(result).toEqual([withValue]);
  });

  it("date range excludes rows outside bounds and rows with no date", () => {
    const inRange = makeRow({ date: "20260115" });
    const outOfRange = makeRow({ date: "20260201" });
    const noDate = makeRow({ date: "" });
    const result = applyFilters([inRange, outOfRange, noDate], {
      ...EMPTY_FILTERS,
      dateFrom: "20260101",
      dateTo: "20260131",
    });
    expect(result).toEqual([inRange]);
  });
});

describe("isFiltersEmpty", () => {
  it("is true for EMPTY_FILTERS", () => {
    expect(isFiltersEmpty(EMPTY_FILTERS)).toBe(true);
  });

  it("is false once any field is set", () => {
    expect(isFiltersEmpty({ ...EMPTY_FILTERS, search: "x" })).toBe(false);
    expect(isFiltersEmpty({ ...EMPTY_FILTERS, components: ["UT"] })).toBe(false);
    expect(isFiltersEmpty({ ...EMPTY_FILTERS, totalDfRange: [0, 1] })).toBe(false);
  });
});

describe("distinctValues", () => {
  it("returns [] for no rows", () => {
    expect(distinctValues([], "component")).toEqual([]);
  });

  it("dedupes, drops blanks, and sorts", () => {
    const rows = [
      makeRow({ component: "UT" }),
      makeRow({ component: "Rear Wing" }),
      makeRow({ component: "UT" }),
      makeRow({ component: "" }),
    ];
    expect(distinctValues(rows, "component")).toEqual(["Rear Wing", "UT"]);
  });
});

describe("dataBounds", () => {
  it("returns null when no rows have a value", () => {
    expect(dataBounds([makeRow({ total_df: null })], "total_df")).toBeNull();
  });

  it("returns [min, max] across rows, ignoring nulls", () => {
    const rows = [
      makeRow({ total_df: -50 }),
      makeRow({ total_df: -200 }),
      makeRow({ total_df: null }),
    ];
    expect(dataBounds(rows, "total_df")).toEqual([-200, -50]);
  });

  it("returns [v, v] for a single row", () => {
    expect(dataBounds([makeRow({ cell_count: 42 })], "cell_count")).toEqual([42, 42]);
  });
});

describe("filters <-> URLSearchParams round-trip", () => {
  it("round-trips a populated filter state", () => {
    const filters = {
      ...EMPTY_FILTERS,
      search: "outwash",
      components: ["UT", "Rear Wing"],
      dateFrom: "20260101",
      totalDfRange: [-200, -100] as [number, number],
    };
    const params = filtersToSearchParams(filters);
    const roundTripped = filtersFromSearchParams(params);
    expect(roundTripped).toEqual(filters);
  });

  it("empty filters produce empty params and round-trip to EMPTY_FILTERS shape", () => {
    const params = filtersToSearchParams(EMPTY_FILTERS);
    expect(Array.from(params.entries())).toEqual([]);
    const roundTripped = filtersFromSearchParams(params);
    expect(roundTripped.components).toEqual([]);
    expect(roundTripped.totalDfRange).toBeNull();
  });
});
