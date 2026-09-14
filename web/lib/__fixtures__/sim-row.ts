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
    full_car_df: -100,
    total_aero_df: -110,
    body_df: 10,
    fw_df: -20,
    rw_df: -30,
    ut_df: -25,
    wheel_df: 5,
    endplate_df: 1,
    swan_neck_df: 0.5,
    carbon_rod_df: 0.2,
    EL4_df: -10,
    EL5_df: -5,
    EL6_df: -3,
    EL7_df: -2,

    full_car_drag: 40,
    body_drag: 8,
    fw_drag: 3,
    rw_drag: 5,
    ut_drag: 4,
    wheel_drag: 3,
    endplate_drag: 0.5,
    swan_neck_dragf: 0.1,
    carbon_rod_drag: 0.1,
    EL4_drag: 4,
    EL5_drag: 3,
    EL6_drag: 2,
    EL7_drag: 1,

    frontal_area: 0.56,
    RW_area: 2.1,
    FW_area: 1.1,
    UT_area: 1.4,
    ClA: -1.8,
    CdA: 0.7,

    full_car_CoP: 50,
    full_car_CoP_meters: 0.8,
    UT_CoP_meters: 0.68,
    RW_CoP_meters: 1.75,

    radiator_MFR: 0.3,
    inlet_MF_averaged_pressure: 60,
    outlet_MF_averaged_pressure: 40,
    pressure_drop: 20,

    cell_count: 1_000_000,
    swept_variable: "",
    swept_range: "",
    swept_value: null,
    swept_value_unit: "",
    scene_image_refs: [],
    source_drive_folder: "",
    ...overrides,
  };
}
