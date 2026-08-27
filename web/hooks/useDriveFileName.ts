"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDriveFileName } from "@/lib/drive";

/** Fetches a Drive file's real name via the Drive API. Only runs once
 * `enabled` (e.g. on first hover, or a selected compare-overlay image) so
 * a one-off name lookup doesn't hit the network until it's actually
 * needed. Result is cached indefinitely per url (shared with
 * useDriveFileNames below, same queryKey shape).
 *
 * For a whole gallery that needs every name up front (to sort/search by
 * name -- see components/detail/scene-gallery.tsx), use useDriveFileNames
 * instead: fetching one-by-one on hover doesn't give you a name to sort by
 * for images the user hasn't hovered yet. */
export function useDriveFileName(url: string, enabled: boolean) {
  return useQuery({
    queryKey: ["drive-file-name", url],
    queryFn: () => fetchDriveFileName(url),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}
