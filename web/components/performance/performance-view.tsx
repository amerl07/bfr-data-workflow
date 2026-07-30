"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSimulations } from "@/hooks/useSimulations";
import { useFilters } from "@/hooks/useFilters";
import { applyFilters } from "@/lib/filters";
import type { NumericMetricKey } from "@/lib/types";
import { FilterSidebar } from "@/components/filters/filter-sidebar";
import { AxisControls } from "@/components/performance/axis-controls";
import { ScatterPlot, type CategoricalKey, type SizeKey } from "@/components/performance/scatter-plot";
import { ExportButton } from "@/components/explorer/export-button";
import { LoadingState, ErrorState, EmptyState } from "@/components/status";

export function PerformanceView() {
  const { data: rows, isLoading, error } = useSimulations();
  const [filters, setFilters] = useFilters();
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const xKey = (searchParams.get("x") as NumericMetricKey) || "total_drag";
  const yKey = (searchParams.get("y") as NumericMetricKey) || "total_df";
  const colorKey = (searchParams.get("color") as CategoricalKey) || "component";
  const sizeKey = (searchParams.get("size") as SizeKey) || "cell_count";

  const updateAxes = useCallback(
    (next: { x?: string; y?: string; color?: string; size?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const filtered = useMemo(() => (rows ? applyFilters(rows, filters) : []), [rows, filters]);
  const selectedRows = useMemo(
    () => filtered.filter((r) => selectedJobs.includes(r.job_name)),
    [filtered, selectedJobs],
  );

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;
  if (!rows) return null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <FilterSidebar rows={rows} filters={filters} onChange={setFilters} />
      <div className="min-w-0 flex-1 space-y-4">
        <AxisControls xKey={xKey} yKey={yKey} colorKey={colorKey} sizeKey={sizeKey} onChange={updateAxes} />

        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <p>
            {filtered.length} simulation{filtered.length === 1 ? "" : "s"} plotted
            {selectedJobs.length > 0 && ` · ${selectedJobs.length} selected`}
          </p>
          {selectedJobs.length > 0 && <ExportButton rows={selectedRows} />}
        </div>

        {filtered.length === 0 ? (
          <EmptyState message="No simulations match the current filters." />
        ) : (
          <ScatterPlot
            rows={filtered}
            xKey={xKey}
            yKey={yKey}
            colorKey={colorKey}
            sizeKey={sizeKey}
            onPointClick={(jobName) => router.push(`/simulation?job=${encodeURIComponent(jobName)}`)}
            onSelectionChange={setSelectedJobs}
          />
        )}
      </div>
    </div>
  );
}
