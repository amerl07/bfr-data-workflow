import Link from "next/link";
import type { SimRow } from "@/lib/types";
import { downforceToDragRatio } from "@/lib/metrics";
import { leaderboard } from "@/lib/stats";
import { formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/status";

interface BoardDef {
  label: string;
  valueFn: (r: SimRow) => number | null;
  order: "asc" | "desc";
  unit?: string;
}

const BOARDS: BoardDef[] = [
  {
    label: "Highest Total Downforce",
    valueFn: (r) => (r.total_df === null ? null : Math.abs(r.total_df)),
    order: "desc",
    unit: "N",
  },
  { label: "Lowest Total Drag", valueFn: (r) => r.total_drag, order: "asc", unit: "N" },
  {
    label: "Highest Total Aero DF",
    valueFn: (r) => (r.total_aero_df === null ? null : Math.abs(r.total_aero_df)),
    order: "desc",
    unit: "N",
  },
  {
    label: "Largest Wheel DF",
    valueFn: (r) => (r.wheel_df === null ? null : Math.abs(r.wheel_df)),
    order: "desc",
    unit: "N",
  },
  {
    label: "Largest Undertray DF",
    valueFn: (r) => (r.ut_df === null ? null : Math.abs(r.ut_df)),
    order: "desc",
    unit: "N",
  },
  { label: "Lowest Cell Count", valueFn: (r) => r.cell_count, order: "asc" },
  {
    label: "Best Downforce-to-Drag Ratio",
    valueFn: downforceToDragRatio,
    order: "desc",
  },
];

export function Leaderboards({ rows }: { rows: SimRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {BOARDS.map((board) => {
        const entries = leaderboard(rows, board.valueFn, board.order, 5);
        return (
          <Card key={board.label}>
            <CardHeader>
              <CardTitle>{board.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <EmptyState message="No data yet." />
              ) : (
                <ol className="flex flex-col gap-1.5">
                  {entries.map((entry, i) => (
                    <li key={entry.row.job_name} className="flex items-center gap-2 text-sm">
                      <span className="w-4 shrink-0 text-slate-400">{i + 1}</span>
                      <Link
                        href={`/simulation?job=${encodeURIComponent(entry.row.job_name)}`}
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {entry.row.job_name}
                      </Link>
                      <span className="shrink-0 font-medium">
                        {formatNumber(entry.value, { unit: board.unit })}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
