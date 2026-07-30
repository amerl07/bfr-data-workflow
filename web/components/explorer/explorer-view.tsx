"use client";

import { useMemo, useState } from "react";
import { useSimulations } from "@/hooks/useSimulations";
import { useFilters } from "@/hooks/useFilters";
import { applyFilters } from "@/lib/filters";
import { FilterSidebar } from "@/components/filters/filter-sidebar";
import { SimCard } from "@/components/explorer/sim-card";
import { SimTable } from "@/components/explorer/sim-table";
import { ViewToggle, type ExplorerView as ViewMode } from "@/components/explorer/view-toggle";
import { ExportButton } from "@/components/explorer/export-button";
import { LoadingState, ErrorState, EmptyState } from "@/components/status";

export function ExplorerView() {
  const { data: rows, isLoading, error } = useSimulations();
  const [filters, setFilters] = useFilters();
  const [view, setView] = useState<ViewMode>("card");

  const filtered = useMemo(() => (rows ? applyFilters(rows, filters) : []), [rows, filters]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;
  if (!rows) return null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <FilterSidebar rows={rows} filters={filters} onChange={setFilters} />
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filtered.length} of {rows.length} simulation{rows.length === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <ExportButton rows={filtered} />
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState message="No simulations match the current filters." />
        ) : view === "card" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((row) => (
              <SimCard key={row.job_name} row={row} />
            ))}
          </div>
        ) : (
          <SimTable rows={filtered} />
        )}
      </div>
    </div>
  );
}
