"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDriveFileName } from "@/lib/drive";

/** Fetches a Drive file's real name via the Drive API. Only runs once
 * `enabled` (e.g. on first hover) so galleries don't burn API quota on
 * images the user never looks at. Result is cached indefinitely per url. */
export function useDriveFileName(url: string, enabled: boolean) {
  return useQuery({
    queryKey: ["drive-file-name", url],
    queryFn: () => fetchDriveFileName(url),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}
