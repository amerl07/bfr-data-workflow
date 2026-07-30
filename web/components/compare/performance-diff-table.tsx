import type { SimRow } from "@/lib/types";
import { METRICS, compareMetric } from "@/lib/metrics";
import { absoluteDelta, formatNumber, formatPercentDelta, percentDelta } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Metric | A | B | Δ | Δ% — covers both the spec's "Performance Comparison"
 * table and its separate "Difference Summary" ask (abs + % diff per metric)
 * in one table rather than duplicating the same numbers twice. */
export function PerformanceDiffTable({ a, b }: { a: SimRow; b: SimRow }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Metric</TableHead>
          <TableHead>A</TableHead>
          <TableHead>B</TableHead>
          <TableHead>Δ</TableHead>
          <TableHead>Δ%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {METRICS.map((m) => {
          const va = a[m.key];
          const vb = b[m.key];
          const aBetter = compareMetric(va, vb, m.better);
          const bBetter = compareMetric(vb, va, m.better);
          const delta = absoluteDelta(va, vb);
          const deltaPct = percentDelta(va, vb);
          return (
            <TableRow key={m.key}>
              <TableCell className="text-slate-500 dark:text-slate-400">
                {m.label}
                {m.unit && <span className="text-slate-400"> ({m.unit})</span>}
              </TableCell>
              <TableCell
                className={cn(
                  aBetter === 1 && "font-medium text-green-600 dark:text-green-400",
                  aBetter === -1 && "text-red-500 dark:text-red-400",
                )}
              >
                {formatNumber(va, { unit: m.unit })}
              </TableCell>
              <TableCell
                className={cn(
                  bBetter === 1 && "font-medium text-green-600 dark:text-green-400",
                  bBetter === -1 && "text-red-500 dark:text-red-400",
                )}
              >
                {formatNumber(vb, { unit: m.unit })}
              </TableCell>
              <TableCell>{formatNumber(delta, { unit: m.unit })}</TableCell>
              <TableCell>{formatPercentDelta(deltaPct)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
