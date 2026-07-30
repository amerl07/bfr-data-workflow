"use client";

import { useQuery } from "@tanstack/react-query";
import { DEFAULT_DATA_URL, fetchResults } from "@/lib/data";

const DATA_URL = process.env.NEXT_PUBLIC_DATA_URL || DEFAULT_DATA_URL;

export function useSimulations() {
  return useQuery({
    queryKey: ["simulations", DATA_URL],
    queryFn: () => fetchResults(DATA_URL),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
