"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  EMPTY_FILTERS,
  filtersFromSearchParams,
  filtersToSearchParams,
  type FilterState,
} from "@/lib/filters";

const FILTER_KEYS = [
  "q",
  "component",
  "sweep",
  "simtype",
  "owner",
  "swept",
  "from",
  "to",
  "df",
  "drag",
  "cop",
  "cells",
];

/** Reads/writes FilterState to the page's URL query string, so filter state
 * is shareable and survives reloads. Non-filter params already on the URL
 * (e.g. Performance Explorer's axis/color/size picks) are preserved. */
export function useFilters(): [FilterState, (next: FilterState) => void, () => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

  const setFilters = useCallback(
    (next: FilterState) => {
      const nextParams = filtersToSearchParams(next);
      const merged = new URLSearchParams(searchParams.toString());
      for (const key of FILTER_KEYS) merged.delete(key);
      for (const [key, value] of nextParams.entries()) merged.set(key, value);
      const qs = merged.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [setFilters]);

  return [filters, setFilters, clearFilters];
}
