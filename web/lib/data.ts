import Papa from "papaparse";
import type { SimRow } from "./types";

export const DEFAULT_DATA_URL =
  "https://raw.githubusercontent.com/amerl07/bfr-data-workflow/main/data/results.csv";

function toNumber(v: string | undefined): number | null {
  if (v === undefined || v === null) return null;
  const trimmed = v.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseDate(yyyymmdd: string | undefined): Date | null {
  if (!yyyymmdd || yyyymmdd.length !== 8) return null;
  const year = Number(yyyymmdd.slice(0, 4));
  const month = Number(yyyymmdd.slice(4, 6));
  const day = Number(yyyymmdd.slice(6, 8));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function splitRefs(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Mirrors `sim_filename_parser.py::_SWEEP_TYPE_ALIASES` on the ingestion
 * side (see CONTRIBUTING.md's sweep-type-codes section): case-insensitive,
 * and CORNER/STRAIGHT (the pre-2026-08-01 codes) alias to
 * CORNERING/STRAIGHTLINE. Applied here too, not just at ingestion, because
 * data/results.csv has rows added by hand (see its git history) that never
 * went through the Python parser and so kept their original casing/code --
 * without this, the filter sidebar and detail views split one sweep type
 * into multiple case- or spelling-variant entries. Every other sweep type
 * code is left exactly as written, same "don't invent" rule as the Python
 * side. */
const SWEEP_TYPE_ALIASES: Record<string, string> = {
  CORNER: "CORNERING",
  CORNERING: "CORNERING",
  STRAIGHT: "STRAIGHTLINE",
  STRAIGHTLINE: "STRAIGHTLINE",
};

export function normalizeSweepType(raw: string): string {
  if (!raw) return raw;
  return SWEEP_TYPE_ALIASES[raw.toUpperCase()] ?? raw;
}

/** Pure CSV-text -> SimRow[] parser, split out from fetchResults so it's testable
 * without a network call. */
export function parseResultsCsv(csvText: string): SimRow[] {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return data
    .filter((row) => (row.job_name ?? "").trim() !== "")
    .map((row) => ({
      job_name: row.job_name.trim(),
      post_zip_name: row.post_zip_name ?? "",
      component: row.component ?? "",
      sweep_type: normalizeSweepType(row.sweep_type ?? ""),
      isolated_vs_fullcar: row.isolated_vs_fullcar ?? "",
      date: row.date ?? "",
      dateObj: parseDate(row.date),
      owner_initials: row.owner_initials ?? "",
      raw_force_values: row.raw_force_values ?? "",

      body_df: toNumber(row.body_df),
      rw_drag: toNumber(row.rw_drag),
      fw_df: toNumber(row.fw_df),
      rw_df: toNumber(row.rw_df),
      total_drag: toNumber(row.total_drag),
      total_df: toNumber(row.total_df),
      ut_df: toNumber(row.ut_df),
      cell_count: toNumber(row.cell_count),
      total_aero_df: toNumber(row.total_aero_df),
      wheel_df: toNumber(row.wheel_df),
      whisker_df: toNumber(row.whisker_df),
      CoP: toNumber(row.CoP),
      CoP_meters: toNumber(row.CoP_meters),

      swept_variable: row.swept_variable ?? "",
      swept_range: row.swept_range ?? "",

      scene_image_refs: splitRefs(row.scene_image_refs),
      source_drive_folder: row.source_drive_folder ?? "",
    }));
}

export async function fetchResults(url: string = DEFAULT_DATA_URL): Promise<SimRow[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch results.csv (${res.status} ${res.statusText})`);
  }
  const text = await res.text();
  return parseResultsCsv(text);
}
