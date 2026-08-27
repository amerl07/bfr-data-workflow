export type SimulationType = "isolated" | "full_car" | string;

/** One row of data/results.csv, typed. Numeric fields are `null` when the
 * source CSV cell was blank. */
export interface SimRow {
  job_name: string;
  post_zip_name: string;
  component: string;
  sweep_type: string;
  isolated_vs_fullcar: SimulationType;
  /** Raw YYYYMMDD string from the CSV. */
  date: string;
  /** Parsed from `date`; null if unparseable. */
  dateObj: Date | null;
  owner_initials: string;
  raw_force_values: string;

  // Downforce panel
  full_car_df: number | null;
  total_aero_df: number | null; // this field should exist, but is only populated if results.csv contains it
  body_df: number | null;
  fw_df: number | null;
  rw_df: number | null;
  ut_df: number | null;
  wheel_df: number | null;
  endplate_df: number | null;
  swan_neck_df: number | null;
  carbon_rod_df: number | null;
  EL4_df: number | null;
  EL5_df: number | null;
  EL6_df: number | null;
  EL7_df: number | null;

  // Drag panel
  full_car_drag: number | null;
  body_drag: number | null;
  fw_drag: number | null;
  rw_drag: number | null;
  ut_drag: number | null;
  wheel_drag: number | null;
  endplate_drag: number | null;
  swan_neck_dragf: number | null;
  carbon_rod_drag: number | null;
  EL4_drag: number | null;
  EL5_drag: number | null;
  EL6_drag: number | null;
  EL7_drag: number | null;

  // Area and Coefficients panel
  frontal_area: number | null;
  RW_area: number | null;
  FW_area: number | null;
  UT_area: number | null;
  ClA: number | null;
  CdA: number | null;

  // Center of Pressure panel
  full_car_CoP: number | null;
  full_car_CoP_meters: number | null;
  UT_CoP_meters: number | null;
  RW_CoP_meters: number | null;

  // Radiator panel
  radiator_MFR: number | null;
  inlet_MF_averaged_pressure: number | null;
  outlet_MF_averaged_pressure: number | null;
  pressure_drop: number | null;

  // Sim Metadata panel
  cell_count: number | null;
  swept_variable: string;
  swept_range: string;

  /** Split on `;`, empty entries dropped. */
  scene_image_refs: string[];
  source_drive_folder: string;
}

/** Keys of SimRow that hold a `number | null` — the numeric metrics. */
export type NumericMetricKey =
  // Downforce panel
  | "full_car_df"
  | "total_aero_df"
  | "body_df"
  | "fw_df"
  | "rw_df"
  | "ut_df"
  | "wheel_df"
  | "endplate_df"
  | "swan_neck_df"
  | "carbon_rod_df"
  | "EL4_df"
  | "EL5_df"
  | "EL6_df"
  | "EL7_df"
  // Drag panel
  | "full_car_drag"
  | "body_drag"
  | "fw_drag"
  | "rw_drag"
  | "ut_drag"
  | "wheel_drag"
  | "endplate_drag"
  | "swan_neck_dragf"
  | "carbon_rod_drag"
  | "EL4_drag"
  | "EL5_drag"
  | "EL6_drag"
  | "EL7_drag"
  // Area and Coefficients panel
  | "frontal_area"
  | "RW_area"
  | "FW_area"
  | "UT_area"
  | "ClA"
  | "CdA"
  // Center of Pressure panel
  | "full_car_CoP"
  | "full_car_CoP_meters"
  | "UT_CoP_meters"
  | "RW_CoP_meters"
  // Radiator panel
  | "radiator_MFR"
  | "inlet_MF_averaged_pressure"
  | "outlet_MF_averaged_pressure"
  | "pressure_drop"
  // Sim Metadata panel
  | "cell_count";
