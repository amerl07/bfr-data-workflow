import { describe, expect, it } from "vitest";
import { normalizeSweepType, parseResultsCsv } from "@/lib/data";

const HEADER =
  "job_name,post_zip_name,component,sweep_type,isolated_vs_fullcar,date,owner_initials," +
  "raw_force_values,body_df,rw_drag,fw_df,rw_df,total_drag,total_df,ut_df,cell_count," +
  "total_aero_df,wheel_df,whisker_df,CoP,CoP_meters,swept_variable,swept_range," +
  "scene_image_refs,source_drive_folder";

function row(fields: Record<string, string>): string {
  const cols = HEADER.split(",");
  return cols.map((c) => fields[c] ?? "").join(",");
}

describe("parseResultsCsv", () => {
  it("returns [] for a header-only CSV (N=0 data rows)", () => {
    expect(parseResultsCsv(HEADER + "\n")).toEqual([]);
  });

  it("returns [] for an empty string", () => {
    expect(parseResultsCsv("")).toEqual([]);
  });

  it("parses a single row, coercing blank numeric cells to null (not 0)", () => {
    const csv = [
      HEADER,
      row({
        job_name: "CD_UT_Outwash_Cornering_20260726",
        component: "UT",
        date: "20260726",
        total_df: "-190.627172",
        fw_df: "", // blank -- CONTRIBUTING.md says this is "not an error", not zero
      }),
    ].join("\n");

    const rows = parseResultsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].job_name).toBe("CD_UT_Outwash_Cornering_20260726");
    expect(rows[0].total_df).toBeCloseTo(-190.627172, 5);
    expect(rows[0].fw_df).toBeNull();
    expect(rows[0].dateObj?.getUTCFullYear()).toBe(2026);
    expect(rows[0].dateObj?.getUTCMonth()).toBe(6); // July, 0-indexed
    expect(rows[0].dateObj?.getUTCDate()).toBe(26);
  });

  it("splits scene_image_refs on ';' and drops blank entries", () => {
    const csv = [
      HEADER,
      row({
        job_name: "X",
        scene_image_refs: "https://a;https://b;",
      }),
    ].join("\n");
    expect(parseResultsCsv(csv)[0].scene_image_refs).toEqual(["https://a", "https://b"]);
  });

  it("drops rows with a blank job_name", () => {
    const csv = [HEADER, row({ job_name: "" }), row({ job_name: "VALID" })].join("\n");
    const rows = parseResultsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].job_name).toBe("VALID");
  });

  it("parses many rows", () => {
    const csv = [HEADER, row({ job_name: "A" }), row({ job_name: "B" }), row({ job_name: "C" })].join(
      "\n",
    );
    expect(parseResultsCsv(csv).map((r) => r.job_name)).toEqual(["A", "B", "C"]);
  });

  it("normalizes sweep_type case and CORNER/STRAIGHT aliases so legacy hand-added rows match ingested ones", () => {
    const csv = [
      HEADER,
      row({ job_name: "A", sweep_type: "CORNERING" }),
      row({ job_name: "B", sweep_type: "Cornering" }),
      row({ job_name: "C", sweep_type: "corner" }),
      row({ job_name: "D", sweep_type: "straightline" }),
      row({ job_name: "E", sweep_type: "Straight" }),
      row({ job_name: "F", sweep_type: "YAW" }),
    ].join("\n");
    expect(parseResultsCsv(csv).map((r) => r.sweep_type)).toEqual([
      "CORNERING",
      "CORNERING",
      "CORNERING",
      "STRAIGHTLINE",
      "STRAIGHTLINE",
      "YAW",
    ]);
  });
});

describe("normalizeSweepType", () => {
  it("passes through an empty string unchanged", () => {
    expect(normalizeSweepType("")).toBe("");
  });

  it("leaves undefined/unlisted codes exactly as written", () => {
    expect(normalizeSweepType("Combo")).toBe("Combo");
    expect(normalizeSweepType("AOA")).toBe("AOA");
  });
});
