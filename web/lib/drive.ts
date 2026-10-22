const DRIVE_ID_PATTERNS = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];

export function extractDriveFileId(url: string): string | null {
  for (const pattern of DRIVE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Thumbnail for a file shared "anyone with the link"; hotlinking the
 * `/file/d/.../view` page itself doesn't render an image. This is the
 * googleusercontent address Drive's own thumbnail endpoint redirects to:
 * requesting it directly skips that redirect, which Drive marks no-store
 * (so it's re-fetched on every view) and throttles when a page loads many
 * at once, while this response is browser-cacheable for 24 hours. It's
 * not a documented API, so DriveImage falls back to
 * driveLegacyThumbnailUrl on retries. Callers must still handle onError
 * (private/unshared files). */
export function driveThumbnailUrl(url: string, size = 1000): string | null {
  const id = extractDriveFileId(url);
  if (!id) return null;
  return `https://lh3.googleusercontent.com/d/${id}=w${size}`;
}

/** Drive's documented thumbnail endpoint (see driveThumbnailUrl). */
export function driveLegacyThumbnailUrl(url: string, size = 1000): string | null {
  const id = extractDriveFileId(url);
  if (!id) return null;
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
}

export function driveViewUrl(url: string): string {
  const id = extractDriveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/view` : url;
}

const DRIVE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;

/** Drive API v3 files.get endpoint for a public ("anyone with the link")
 * file's name. Null if no id can be extracted or no API key is configured
 * (see web/README.md#drive-api-key) -- callers should fall back to a
 * positional label in that case. */
export function driveFileMetadataUrl(url: string): string | null {
  const id = extractDriveFileId(url);
  if (!id || !DRIVE_API_KEY) return null;
  return `https://www.googleapis.com/drive/v3/files/${id}?fields=name&key=${DRIVE_API_KEY}`;
}

// A file id's name never changes, so names are kept in localStorage across
// visits; otherwise every page load re-asks Drive (no-store) for every
// image, ~90 requests per sim, before galleries can sort or the slice
// roller can find its slices. Keyed by file id, not url, so different link
// shapes to one file share an entry. Storage can be missing or blocked
// (private windows, tests), so every access is guarded and the in-memory
// copy still works on its own.
const NAME_CACHE_KEY = "drive-file-names-v1";
let nameCache: Record<string, string> | null = null;
let nameCacheSaveTimer: ReturnType<typeof setTimeout> | null = null;

function loadNameCache(): Record<string, string> {
  if (nameCache) return nameCache;
  try {
    nameCache = JSON.parse(localStorage.getItem(NAME_CACHE_KEY) ?? "{}") as Record<string, string>;
  } catch {
    nameCache = {};
  }
  return nameCache;
}

function rememberName(id: string, name: string) {
  loadNameCache()[id] = name;
  // One write per burst of lookups rather than one per file.
  if (nameCacheSaveTimer) return;
  nameCacheSaveTimer = setTimeout(() => {
    nameCacheSaveTimer = null;
    try {
      localStorage.setItem(NAME_CACHE_KEY, JSON.stringify(nameCache));
    } catch {
      // Storage full or unavailable: the in-memory copy still serves this visit.
    }
  }, 500);
}

export async function fetchDriveFileName(url: string): Promise<string | null> {
  const id = extractDriveFileId(url);
  if (!id) return null;
  const cached = loadNameCache()[id];
  if (cached) return cached;
  const endpoint = driveFileMetadataUrl(url);
  if (!endpoint) return null;
  const res = await fetch(endpoint);
  if (!res.ok) return null;
  const data = (await res.json()) as { name?: string };
  if (data.name) rememberName(id, data.name);
  return data.name ?? null;
}
