"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { driveThumbnailUrl } from "@/lib/drive";

// 1 + 2 + 4 + 8 + 16 s: outlasts the burst while a page's galleries load.
const MAX_RETRIES = 5;

/** A Drive thumbnail that retries with backoff. Drive's thumbnail endpoint
 * intermittently rejects requests when a page loads many at once (the same
 * url fails, then loads on a retry), so a single onError isn't final.
 * Renders `fallback` once retries run out (nothing by default). Key it by
 * url so a new image starts with a fresh retry count. */
export function DriveImage({
  url,
  size,
  alt,
  className,
  style,
  fallback = null,
}: {
  url: string;
  size: number;
  alt: string;
  className?: string;
  style?: CSSProperties;
  fallback?: ReactNode;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const thumb = driveThumbnailUrl(url, size);

  if (!thumb || failed) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // A fresh query param per retry so the browser doesn't reuse the failed response.
      src={attempt === 0 ? thumb : `${thumb}&retry=${attempt}`}
      alt={alt}
      draggable={false}
      onError={() => {
        if (attempt >= MAX_RETRIES) setFailed(true);
        else setTimeout(() => setAttempt((a) => a + 1), 1000 * 2 ** attempt);
      }}
      className={className}
      style={style}
    />
  );
}
