import type { SimRow } from "@/lib/types";
import { METRICS } from "@/lib/metrics";
import { absoluteDeltaTone, percentDeltaTone, type DeltaTone } from "@/lib/compare";
import { absoluteDelta, formatNumber, formatPercentDelta, percentDelta } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SimColumnHeads, STICKY_LABEL_COL } from "@/components/compare/compare-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function toneClass(tone: DeltaTone) {
  return cn(
    tone === "better" && "font-medium text-green-600 dark:text-green-400",
    tone === "worse" && "font-medium text-red-500 dark:text-red-400",
  );
}

function formatSignedNumber(value: number | null, unit: string) {
  const formatted = formatNumber(value, { unit });
  return value !== null && value > 0 ? `+${formatted}` : formatted;
}

/** Metric | one column per sim. Each non-baseline cell shows its value with
 * Δ and Δ% vs. the baseline underneath -- stacked in-cell rather than as
 * separate Δ/Δ% columns per sim, so the table only grows one column per
 * added simulation. */
export function PerformanceDiffTable({ rows, baseline }: { rows: SimRow[]; baseline: SimRow }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={STICKY_LABEL_COL}>Metric</TableHead>
          <SimColumnHeads rows={rows} baseline={baseline} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {METRICS.map((m) => {
          const vBase = baseline[m.key];
          return (
            <TableRow key={m.key}>
              <TableCell className={cn(STICKY_LABEL_COL, "text-slate-500 dark:text-slate-400")}>
                {m.label}
                {m.unit && <span className="text-slate-400"> ({m.unit})</span>}
              </TableCell>
              {rows.map((r) => {
                const v = r[m.key];
                const isBase = r.job_name === baseline.job_name;
                const delta = absoluteDelta(vBase, v);
                const deltaPct = percentDelta(vBase, v);
                return (
                  <TableCell key={r.job_name} className="align-top">
                    <div>{formatNumber(v, { unit: m.unit })}</div>
                    {!isBase && (delta !== null || deltaPct !== null) && (
                      <div className="text-xs text-slate-400">
                        <span className={toneClass(absoluteDeltaTone(m, vBase, v))}>
                          {formatSignedNumber(delta, m.unit)}
                        </span>
                        <span className="mx-1">·</span>
                        <span className={toneClass(percentDeltaTone(m, vBase, v))}>
                          {formatPercentDelta(deltaPct)}
                        </span>
                      </div>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
