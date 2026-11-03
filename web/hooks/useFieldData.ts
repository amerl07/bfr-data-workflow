"use client";

import { useQueries } from "@tanstack/react-query";
import { driveMediaUrl, extractDriveFileId } from "@/lib/drive";
import { parseFieldFile, type FieldFile, type FieldFileJson } from "@/lib/fields";

/** A Drive link goes through the Drive API; anything else (e.g. a file in
 * public/ for local testing) is fetched as is. */
async function fetchFieldFile(url: string): Promise<FieldFile> {
  const endpoint = extractDriveFileId(url) ? driveMediaUrl(url) : url;
  if (!endpoint) {
    throw new Error("Field data needs a Drive API key (NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY).");
  }
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Couldn't download field data (${res.status} ${res.statusText})`);
  return parseFieldFile((await res.json()) as FieldFileJson);
}

/** Downloads and decodes each sim's `<job>_fields.json` (about 1 MB each).
 * A file id's contents never change, so results are kept for the session.
 * Blank urls are skipped (data undefined, not an error). */
export function useFieldData(urls: string[]) {
  return useQueries({
    queries: urls.map((url) => ({
      queryKey: ["field-data", url],
      queryFn: () => fetchFieldFile(url),
      enabled: !!url,
      staleTime: Infinity,
      gcTime: Infinity,
      retry: 1,
    })),
  });
}
