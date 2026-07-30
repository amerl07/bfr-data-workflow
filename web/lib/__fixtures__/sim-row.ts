import type { SimRow } from "@/lib/types";

let counter = 0;

export function makeRow(overrides: Partial<SimRow> = {}): SimRow {
  counter += 1;
  return {
    job_name: `TEST_ROW_${counter}`,
    post_zip_name: `post_TEST_ROW_${counter}.zip`,
    component: "UT",
    sweep_type: "Cornering",
    isolated_vs_fullcar: "isolated",
    date: "20260101",
    dateObj: new Date(Date.UTC(2026, 0, 1)),
    owner_initials: "AB",
    raw_force_values: "Body DF=10N",
    body_df: 10,
    rw_drag: 5,
    fw_df: -20,
    rw_df: -30,
    total_drag: 40,
    total_df: -100,
    ut_df: -25,
    cell_count: 1_000_000,
    total_aero_df: -110,
    wheel_df: 5,
    whisker_df: 2,
    CoP: 50,
    CoP_meters: 0.8,
    swept_variable: "",
    swept_range: "",
    scene_image_refs: [],
    source_drive_folder: "",
    ...overrides,
  };
}
