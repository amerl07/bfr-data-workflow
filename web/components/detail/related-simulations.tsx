import Link from "next/link";
import type { SimRow } from "@/lib/types";
import { findRelatedSimulations } from "@/lib/related";
import { formatDate, formatNumber } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/status";

export function RelatedSimulations({ current, all }: { current: SimRow; all: SimRow[] }) {
  const related = findRelatedSimulations(current, all);

  if (related.length === 0) {
    return <EmptyState message="No related simulations found yet." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {related.map((row) => (
        <Link key={row.job_name} href={`/simulation?job=${encodeURIComponent(row.job_name)}`}>
          <Card className="h-full transition-colors hover:border-blue-400 dark:hover:border-blue-500">
            <CardContent className="pt-4">
              <p className="line-clamp-2 text-sm font-medium">{row.job_name}</p>
              <p className="mt-1 text-xs text-slate-400">
                {row.component} · {row.sweep_type} · {formatDate(row.date)}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Total DF: {formatNumber(row.total_df, { unit: "N" })}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
