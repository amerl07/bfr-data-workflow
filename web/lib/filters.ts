import type { NumericMetricKey, SimRow } from "./types";

export interface FilterState {
  search: string;
  components: string[];
  sweepTypes: string[];
  simTypes: string[];
  owners: string[];
  sweptVariables: string[];
  dateFrom: string | null;
  dateTo: string | null;
  totalDfRange: [number, number] | null;
  totalDragRange: [number, number] | null;
  copRange: [number, number] | null;
  cellCountRange: [number, number] | null;
}

export const EMPTY_FILTERS: FilterState = {
  search: "",
  components: [],
  sweepTypes: [],
  simTypes: [],
  owners: [],
  sweptVariables: [],
  dateFrom: null,
  dateTo: null,
  totalDfRange: null,
  totalDragRange: null,
  copRange: null,
  cellCountRange: null,
};

function matchesRange(value: number | null, range: [number, number] | null): boolean {
  if (range === null) return true;
  if (value === null) return false;
  return value >= range[0] && value <= range[1];
}

export function applyFilters(rows: SimRow[], filters: FilterState): SimRow[] {
  return rows.filter((row) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = `${row.job_name} ${row.post_zip_name}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.components.length && !filters.components.includes(row.component)) return false;
    if (filters.sweepTypes.length && !filters.sweepTypes.includes(row.sweep_type)) return false;
    if (filters.simTypes.length && !filters.simTypes.includes(row.isolated_vs_fullcar)) {
      return false;
    }
    if (filters.owners.length && !filters.owners.includes(row.owner_initials)) return false;
    if (
      filters.sweptVariables.length &&
      !filters.sweptVariables.includes(row.swept_variable)
    ) {
      return false;
    }
    if (filters.dateFrom && (!row.date || row.date < filters.dateFrom)) return false;
    if (filters.dateTo && (!row.date || row.date > filters.dateTo)) return false;
    if (!matchesRange(row.total_df, filters.totalDfRange)) return false;
    if (!matchesRange(row.total_drag, filters.totalDragRange)) return false;
    if (!matchesRange(row.CoP, filters.copRange)) return false;
    if (!matchesRange(row.cell_count, filters.cellCountRange)) return false;
    return true;
  });
}

export function isFiltersEmpty(filters: FilterState): boolean {
  return (
    !filters.search &&
    filters.components.length === 0 &&
    filters.sweepTypes.length === 0 &&
    filters.simTypes.length === 0 &&
    filters.owners.length === 0 &&
    filters.sweptVariables.length === 0 &&
    !filters.dateFrom &&
    !filters.dateTo &&
    !filters.totalDfRange &&
    !filters.totalDragRange &&
    !filters.copRange &&
    !filters.cellCountRange
  );
}

/** Distinct, sorted, non-blank values for a string column — filter option
 * lists are derived from live data rather than hardcoded, so new
 * components/sweep types/owners from the pipeline show up automatically. */
export function distinctValues(rows: SimRow[], key: keyof SimRow): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = row[key];
    if (typeof v === "string" && v.trim() !== "") set.add(v);
  }
  return Array.from(set).sort();
}

export function dataBounds(rows: SimRow[], key: NumericMetricKey): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    const v = row[key];
    if (v === null) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === Infinity) return null;
  return [min, max];
}

const ARRAY_SEP = ",";

export function filtersToSearchParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.components.length) params.set("component", filters.components.join(ARRAY_SEP));
  if (filters.sweepTypes.length) params.set("sweep", filters.sweepTypes.join(ARRAY_SEP));
  if (filters.simTypes.length) params.set("simtype", filters.simTypes.join(ARRAY_SEP));
  if (filters.owners.length) params.set("owner", filters.owners.join(ARRAY_SEP));
  if (filters.sweptVariables.length) params.set("swept", filters.sweptVariables.join(ARRAY_SEP));
  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo) params.set("to", filters.dateTo);
  if (filters.totalDfRange) params.set("df", filters.totalDfRange.join(ARRAY_SEP));
  if (filters.totalDragRange) params.set("drag", filters.totalDragRange.join(ARRAY_SEP));
  if (filters.copRange) params.set("cop", filters.copRange.join(ARRAY_SEP));
  if (filters.cellCountRange) params.set("cells", filters.cellCountRange.join(ARRAY_SEP));
  return params;
}

function parseArrayParam(params: URLSearchParams, key: string): string[] {
  const v = params.get(key);
  if (!v) return [];
  return v.split(ARRAY_SEP).filter(Boolean);
}

function parseRangeParam(params: URLSearchParams, key: string): [number, number] | null {
  const v = params.get(key);
  if (!v) return null;
  const parts = v.split(ARRAY_SEP).map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  return [parts[0], parts[1]];
}

export function filtersFromSearchParams(params: URLSearchParams): FilterState {
  return {
    search: params.get("q") ?? "",
    components: parseArrayParam(params, "component"),
    sweepTypes: parseArrayParam(params, "sweep"),
    simTypes: parseArrayParam(params, "simtype"),
    owners: parseArrayParam(params, "owner"),
    sweptVariables: parseArrayParam(params, "swept"),
    dateFrom: params.get("from"),
    dateTo: params.get("to"),
    totalDfRange: parseRangeParam(params, "df"),
    totalDragRange: parseRangeParam(params, "drag"),
    copRange: parseRangeParam(params, "cop"),
    cellCountRange: parseRangeParam(params, "cells"),
  };
}
