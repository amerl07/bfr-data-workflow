"use client";

import { useRef, useState, type RefObject } from "react";
import type { SimRow } from "@/lib/types";
import { driveThumbnailUrl, driveViewUrl } from "@/lib/drive";
import { EmptyState } from "@/components/status";

function GalleryColumn({
  label,
  images,
  scrollRef,
  onScroll,
}: {
  label: string;
  images: string[];
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: (top: number) => void;
}) {
  return (
    <div className="flex-1">
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div
        ref={scrollRef}
        onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
        className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-800 sm:grid-cols-3"
      >
        {images.length === 0 && (
          <p className="col-span-full text-sm text-slate-400">No images</p>
        )}
        {images.map((url, i) => {
          const thumb = driveThumbnailUrl(url);
          return (
            <a
              key={url + i}
              href={driveViewUrl(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square overflow-hidden rounded bg-slate-100 dark:bg-slate-800"
            >
              {thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="Scene" loading="lazy" className="h-full w-full object-cover" />
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function SyncedGalleries({ a, b }: { a: SimRow; b: SimRow }) {
  const [sync, setSync] = useState(true);
  const refA = useRef<HTMLDivElement>(null);
  const refB = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  function handleScroll(source: "a" | "b", top: number) {
    if (!sync || syncing.current) return;
    syncing.current = true;
    const target = source === "a" ? refB.current : refA.current;
    if (target) target.scrollTop = top;
    syncing.current = false;
  }

  if (a.scene_image_refs.length === 0 && b.scene_image_refs.length === 0) {
    return <EmptyState message="Neither simulation has scene images." />;
  }

  return (
    <div>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={sync}
          onChange={(e) => setSync(e.target.checked)}
          className="h-4 w-4 rounded border-slate-400"
        />
        Synchronize scrolling
      </label>
      <div className="flex flex-col gap-4 sm:flex-row">
        <GalleryColumn
          label="Simulation A"
          images={a.scene_image_refs}
          scrollRef={refA}
          onScroll={(top) => handleScroll("a", top)}
        />
        <GalleryColumn
          label="Simulation B"
          images={b.scene_image_refs}
          scrollRef={refB}
          onScroll={(top) => handleScroll("b", top)}
        />
      </div>
    </div>
  );
}
