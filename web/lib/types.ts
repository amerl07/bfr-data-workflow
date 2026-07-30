export type SimulationType = "isolated" | "full_car" | string;

/** One row of data/results.csv, typed. Numeric fields are `null` when the
 * source CSV cell was blank (not an error, not zero — see CONTRIBUTING.md §4). */
export interface SimRow {
  job_name: string;
  post_zip_name: string;
  component: string;
  sweep_type: string;
  isolated_vs_fullcar: SimulationType;
  /** Raw YYYYMMDD string from the CSV, as-is. */
  date: string;
  /** Parsed from `date`; null if unparseable. */
  dateObj: Date | null;
  owner_initials: string;
  raw_force_values: string;

  body_df: number | null;
  rw_drag: number | null;
  fw_df: number | null;
  rw_df: number | null;
  total_drag: number | null;
  total_df: number | null;
  ut_df: number | null;
  cell_count: number | null;
  total_aero_df: number | null;
  wheel_df: number | null;
  whisker_df: number | null;
  CoP: number | null;
  CoP_meters: number | null;

  swept_variable: string;
  swept_range: string;

  /** Split on `;`, empty entries dropped. */
  scene_image_refs: string[];
  source_drive_folder: string;
}

/** Keys of SimRow that hold a `number | null` — the numeric metrics. */
export type NumericMetricKey =
  | "body_df"
  | "rw_drag"
  | "fw_df"
  | "rw_df"
  | "total_drag"
  | "total_df"
  | "ut_df"
  | "cell_count"
  | "total_aero_df"
  | "wheel_df"
  | "whisker_df"
  | "CoP"
  | "CoP_meters";
