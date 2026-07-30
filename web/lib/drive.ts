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
