import { describe, expect, it } from "vitest";
import { normalizeLabel, parseRawForceValues } from "@/lib/rawForceValues";

// Real sample: docs/"force_reports copy.txt" (run
// DY_RW_newMainplaneGurney_straightline_20260731), run through
// ingestion.queue_consumer.main.format_raw_force_values -- the underscore-
// labeled format that broke the parser (see force_reports_parser.py's
// module docstring, 2026-08-01 finding).
const RAW =
  "FW_DF=-132.662185N;RW_DF=-178.278185N;UT_DF=-93.563664N;Total_DF=-409.591108N;" +
  "Total_Aero_DF=-416.486184N;Total_Drag=187.465275N;CoP_Meters=0.925618m;" +
  "Body_DF=-20.843421N;CoP=58.769417;Whisker_DF=8.798955N;Wheel_DF=6.895076N;" +
  "Radiator_MFR=0.27051kg/s;Inlet_MFA=70.430064Pa;Outlet_MFA=39.612067Pa;" +
  "Pressure_Drop=30.817996;Cell Count=37746121.0";

describe("normalizeLabel", () => {
  it("treats underscore and space-separated spellings as equal", () => {
    expect(normalizeLabel("Radiator_MFR")).toBe(normalizeLabel("Radiator MFR"));
    expect(normalizeLabel("CoP_Meters")).toBe(normalizeLabel("CoP meters"));
  });
});

describe("parseRawForceValues", () => {
  it("returns an empty map for an empty string", () => {
    expect(parseRawForceValues("").size).toBe(0);
  });

  it("splits a value from a concatenated unit with no separator", () => {
    const entries = parseRawForceValues(RAW);
    expect(entries.get("radiator mfr")).toEqual({
      label: "Radiator_MFR",
      value: 0.27051,
      unit: "kg/s",
    });
    expect(entries.get("inlet mfa")).toEqual({ label: "Inlet_MFA", value: 70.430064, unit: "Pa" });
    expect(entries.get("outlet mfa")).toEqual({ label: "Outlet_MFA", value: 39.612067, unit: "Pa" });
  });

  it("handles a trailing entry with no unit", () => {
    expect(parseRawForceValues(RAW).get("pressure drop")).toEqual({
      label: "Pressure_Drop",
      value: 30.817996,
      unit: "",
    });
  });

  it("is looked up the same way regardless of underscore vs space in the source label", () => {
    const underscored = parseRawForceValues("Radiator_MFR=0.27051kg/s");
    const spaced = parseRawForceValues("Radiator MFR=0.27051kg/s");
    expect(underscored.get(normalizeLabel("Radiator MFR"))?.value).toBe(
      spaced.get(normalizeLabel("Radiator_MFR"))?.value,
    );
  });
});
