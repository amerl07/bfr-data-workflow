import { describe, expect, it } from "vitest";
import { findRelatedSimulations } from "@/lib/related";
import { makeRow } from "@/lib/__fixtures__/sim-row";

describe("findRelatedSimulations", () => {
  it("returns [] when there are no other rows", () => {
    const current = makeRow();
    expect(findRelatedSimulations(current, [current])).toEqual([]);
  });

  it("excludes the current row itself even if duplicated by job_name", () => {
    const current = makeRow({ job_name: "SAME" });
    const dup = makeRow({ job_name: "SAME", component: "UT" });
    expect(findRelatedSimulations(current, [current, dup])).toEqual([]);
  });

  it("scores by shared component/sweep_type/swept_variable/owner and ranks higher matches first", () => {
    const current = makeRow({
      job_name: "CURRENT",
      component: "UT",
      sweep_type: "Cornering",
      swept_variable: "Ride Height",
      owner_initials: "CD",
    });
    const twoMatches = makeRow({
      job_name: "TWO",
      component: "UT",
      sweep_type: "Cornering",
      owner_initials: "AB",
    });
    const oneMatch = makeRow({
      job_name: "ONE",
      component: "UT",
      sweep_type: "Pitch",
      owner_initials: "AB",
    });
    const noMatch = makeRow({
      job_name: "NONE",
      component: "Rear Wing",
      sweep_type: "Pitch",
      owner_initials: "AB",
    });

    const result = findRelatedSimulations(current, [oneMatch, noMatch, twoMatches]);
    expect(result.map((r) => r.job_name)).toEqual(["TWO", "ONE"]);
  });

  it("never matches on blank fields shared between rows", () => {
    const current = makeRow({
      job_name: "CURRENT",
      swept_variable: "",
      component: "UT",
      sweep_type: "Cornering",
      owner_initials: "CD",
    });
    const other = makeRow({
      job_name: "OTHER",
      swept_variable: "",
      component: "Whisker",
      sweep_type: "Pitch",
      owner_initials: "AB",
    });
    expect(findRelatedSimulations(current, [other])).toEqual([]);
  });

  it("respects the limit", () => {
    const current = makeRow({ job_name: "CURRENT", component: "UT" });
    const others = Array.from({ length: 10 }, (_, i) =>
      makeRow({ job_name: `OTHER_${i}`, component: "UT" }),
    );
    expect(findRelatedSimulations(current, others, 3)).toHaveLength(3);
  });
});
