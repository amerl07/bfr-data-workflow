import Link from "next/link";
import type { SimRow } from "@/lib/types";
import { getBatchSiblings, formatSweptRange } from "@/lib/batch";
import { formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Also doubles as this sim's "part of a batch" indicator: any row with a
 * source_drive_folder (i.e. its post.zip landed inside a named Drive batch
 * folder, not dropped loose) lists every sibling sharing that folder here,
 * sorted along swept_value -- see CONTRIBUTING.md §1b. */
export function SweepInformation({ row, all }: { row: SimRow; all: SimRow[] }) {
  const siblings = getBatchSiblings(row, all);
  const range = formatSweptRange(siblings) || row.swept_range;

  if (!row.swept_variable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sweep Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">
            No parameter sweep associated with this simulation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sweep Information</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Swept Variable</span>
            <span className="font-medium">{row.swept_variable}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Sweep Range</span>
            <span className="font-medium">{range || "—"}</span>
          </div>
        </div>

        {siblings.length > 1 && (
          <div className="flex flex-col gap-1 border-t border-slate-200 pt-3 dark:border-slate-800">
            <span className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Batch ({siblings.length} sims)
            </span>
            {siblings.map((sibling) => {
              const isCurrent = sibling.job_name === row.job_name;
              return (
                <div
                  key={sibling.job_name}
                  className={`flex items-center justify-between rounded px-2 py-1 ${
                    isCurrent ? "bg-blue-50 dark:bg-blue-950/40" : ""
                  }`}
                >
                  {isCurrent ? (
                    <span className="font-medium">{sibling.job_name}</span>
                  ) : (
                    <Link
                      href={`/simulation?job=${encodeURIComponent(sibling.job_name)}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {sibling.job_name}
                    </Link>
                  )}
                  <span className="text-slate-500 dark:text-slate-400">
                    {sibling.swept_value !== null
                      ? formatNumber(sibling.swept_value, { unit: sibling.swept_value_unit })
                      : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
