"use client";

import { Search } from "lucide-react";
import type { SimRow } from "@/lib/types";
import {
  EMPTY_FILTERS,
  dataBounds,
  distinctValues,
  isFiltersEmpty,
  type FilterState,
} from "@/lib/filters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { RangeField } from "@/components/filters/range-field";

function isoToYyyymmdd(iso: string): string {
  return iso.replaceAll("-", "");
}

function yyyymmddToIso(v: string | null): string {
  if (!v || v.length !== 8) return "";
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}

interface FilterSidebarProps {
  rows: SimRow[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
}

export function FilterSidebar({ rows, filters, onChange }: FilterSidebarProps) {
  const components = distinctValues(rows, "component");
  const sweepTypes = distinctValues(rows, "sweep_type");
  const simTypes = distinctValues(rows, "isolated_vs_fullcar");
  const owners = distinctValues(rows, "owner_initials");
  const sweptVariables = distinctValues(rows, "swept_variable");

  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 lg:w-64">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filters</h2>
        {!isFiltersEmpty(filters) && (
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear all
          </Button>
        )}
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Search
        </span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-8"
            placeholder="Job name or ZIP filename"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>
      </div>

      <MultiSelect
        label="Component"
        options={components}
        selected={filters.components}
        onChange={(v) => set("components", v)}
      />
      <MultiSelect
        label="Sweep Type"
        options={sweepTypes}
        selected={filters.sweepTypes}
        onChange={(v) => set("sweepTypes", v)}
      />
      <MultiSelect
        label="Simulation Type"
        options={simTypes}
        selected={filters.simTypes}
        onChange={(v) => set("simTypes", v)}
      />
      <MultiSelect
        label="Owner"
        options={owners}
        selected={filters.owners}
        onChange={(v) => set("owners", v)}
      />
      <MultiSelect
        label="Swept Variable"
        options={sweptVariables}
        selected={filters.sweptVariables}
        onChange={(v) => set("sweptVariables", v)}
      />

      <div>
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Date range
        </span>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={yyyymmddToIso(filters.dateFrom)}
            onChange={(e) => set("dateFrom", e.target.value ? isoToYyyymmdd(e.target.value) : null)}
          />
          <Input
            type="date"
            value={yyyymmddToIso(filters.dateTo)}
            onChange={(e) => set("dateTo", e.target.value ? isoToYyyymmdd(e.target.value) : null)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Performance filters
        </h3>
        <RangeField
          label="Total Downforce"
          unit="N"
          bounds={dataBounds(rows, "total_df")}
          value={filters.totalDfRange}
          onChange={(v) => set("totalDfRange", v)}
        />
        <RangeField
          label="Total Drag"
          unit="N"
          bounds={dataBounds(rows, "total_drag")}
          value={filters.totalDragRange}
          onChange={(v) => set("totalDragRange", v)}
        />
        <RangeField
          label="CoP"
          unit="%"
          bounds={dataBounds(rows, "CoP")}
          value={filters.copRange}
          onChange={(v) => set("copRange", v)}
        />
        <RangeField
          label="Cell Count"
          bounds={dataBounds(rows, "cell_count")}
          value={filters.cellCountRange}
          onChange={(v) => set("cellCountRange", v)}
        />
      </div>
    </aside>
  );
}
