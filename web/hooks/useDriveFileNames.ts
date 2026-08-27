"use client";

import { useQueries } from "@tanstack/react-query";
import { fetchDriveFileName } from "@/lib/drive";

/** Eagerly fetches every url's real Drive filename in parallel, for
 * galleries that need to sort/search by name up front (see
 * SceneGallery) rather than resolving names lazily on hover. Uses the
 * same queryKey shape as useDriveFileName, so the two share one cache --
 * whichever fires first (this, or a per-thumbnail hover) is the only one
 * that actually hits the network for a given url. */
export function useDriveFileNames(urls: string[]): Record<string, string | null> {
  const results = useQueries({
    queries: urls.map((url) => ({
      queryKey: ["drive-file-name", url],
      queryFn: () => fetchDriveFileName(url),
      staleTime: Infinity,
      retry: false,
    })),
  });

  const names: Record<string, string | null> = {};
  urls.forEach((url, i) => {
    names[url] = results[i]?.data ?? null;
  });
  return names;
}
