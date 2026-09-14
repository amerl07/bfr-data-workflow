import type { SimRow } from "./types";

/** Sims sharing `row`'s batch/sweep folder (`source_drive_folder`),
 * including `row` itself, sorted by swept_value ascending (rows with no
 * swept_value -- e.g. a stray file dropped in the batch folder that didn't
 * match the sweep convention -- sort last). Blank source_drive_folder never
 * matches anything (a loose, non-batch drop), same "blank fields never
 * match" rule as lib/related.ts. */
export function getBatchSiblings(row: SimRow, all: SimRow[]): SimRow[] {
  if (!row.source_drive_folder) return [];
  return all
    .filter((r) => r.source_drive_folder === row.source_drive_folder)
    .sort((a, b) => {
      if (a.swept_value === null && b.swept_value === null) return 0;
      if (a.swept_value === null) return 1;
      if (b.swept_value === null) return -1;
      return a.swept_value - b.swept_value;
    });
}

/** Min-max swept_value across a batch, formatted with its unit (e.g.
 * "30-45mm"). Computed live from whatever's been ingested so far, rather
 * than stored per-row at ingestion time, so it can't go stale mid-batch as
 * more sims land -- see CONTRIBUTING.md §1b. "" if fewer than two rows have
 * a numeric swept_value (nothing to range over yet). */
export function formatSweptRange(rows: SimRow[]): string {
  const values = rows.map((r) => r.swept_value).filter((v): v is number => v !== null);
  if (values.length < 2) return "";
  const unit = rows.find((r) => r.swept_value !== null)?.swept_value_unit ?? "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  return `${min}-${max}${unit}`;
}
