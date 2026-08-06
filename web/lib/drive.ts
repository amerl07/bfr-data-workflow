const DRIVE_ID_PATTERNS = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];

export function extractDriveFileId(url: string): string | null {
  for (const pattern of DRIVE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Drive thumbnail endpoint — works for files shared "anyone with the
 * link"; hotlinking the `/file/d/.../view` page itself doesn't render an
 * image. Callers must still handle onError (private/unshared files). */
export function driveThumbnailUrl(url: string, size = 1000): string | null {
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

export async function fetchDriveFileName(url: string): Promise<string | null> {
  const endpoint = driveFileMetadataUrl(url);
  if (!endpoint) return null;
  const res = await fetch(endpoint);
  if (!res.ok) return null;
  const data = (await res.json()) as { name?: string };
  return data.name ?? null;
}
