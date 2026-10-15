import type { SimRow } from "@/lib/types";
import { TableHead } from "@/components/ui/table";

/** First (label) column of the compare tables: pinned to the left edge so
 * metric/property names stay visible while the sim columns scroll
 * horizontally. Background matches the page so scrolled cells don't show
 * through. */
export const STICKY_LABEL_COL =
  "sticky left-0 z-10 bg-slate-50 dark:bg-slate-950 shadow-[1px_0_0_0_var(--color-slate-200)] dark:shadow-[1px_0_0_0_var(--color-slate-800)]";

/** One column header per compared simulation, letter-labelled to match the
 * pickers, with the baseline marked. Full job name on hover. */
export function SimColumnHeads({ rows, baseline }: { rows: SimRow[]; baseline: SimRow }) {
  return rows.map((r, i) => (
    <TableHead key={r.job_name} title={r.job_name} className="w-56 min-w-56 max-w-56 normal-case tracking-normal">
      <span className="block text-xs uppercase tracking-wide">
        {String.fromCharCode(65 + i)}
        {r.job_name === baseline.job_name && (
          <span className="ml-1.5 rounded bg-blue-100 px-1 py-px text-[10px] text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            Baseline
          </span>
        )}
      </span>
      <span className="block truncate font-normal text-slate-400">{r.job_name}</span>
    </TableHead>
  ));
}
