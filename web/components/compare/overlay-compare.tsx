"use client";

import { useState } from "react";
import type { SimRow } from "@/lib/types";
import { driveThumbnailUrl } from "@/lib/drive";
import { useDriveFileName } from "@/hooks/useDriveFileName";
import { ImageOverlay } from "@/components/shared/image-overlay";
import { EmptyState } from "@/components/status";
import { cn } from "@/lib/utils";

function ImageStrip({
  label,
  images,
  selected,
  onSelect,
}: {
  label: string;
  images: string[];
  selected: string | null;
  onSelect: (url: string) => void;
}) {
  if (images.length === 0) {
    return <p className="text-sm text-slate-400">{label}: no scene images</p>;
  }
  return (
    <div>
      <p className="mb-2 truncate text-sm font-medium">{label}</p>
      <div className="flex gap-2 overflow-x-auto rounded-md border border-slate-200 p-2 dark:border-slate-800">
        {images.map((url, i) => {
          const thumb = driveThumbnailUrl(url);
          if (!thumb) return null;
          return (
            <button
              key={url + i}
              type="button"
              onClick={() => onSelect(url)}
              className={cn(
                "aspect-square h-16 w-16 shrink-0 overflow-hidden rounded border-2",
                selected === url ? "border-blue-600" : "border-transparent",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb} alt="Scene" className="h-full w-full object-cover" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SelectedOverlay({
  a,
  b,
  urlA,
  urlB,
}: {
  a: SimRow;
  b: SimRow;
  urlA: string;
  urlB: string;
}) {
  const { data: nameA } = useDriveFileName(urlA, true);
  const { data: nameB } = useDriveFileName(urlB, true);

  return (
    <ImageOverlay
      imageA={{ url: urlA, label: nameA || a.job_name }}
      imageB={{ url: urlB, label: nameB || b.job_name }}
    />
  );
}

export function OverlayCompare({ a, b }: { a: SimRow; b: SimRow }) {
  const [imageA, setImageA] = useState<string | null>(null);
  const [imageB, setImageB] = useState<string | null>(null);

  if (a.scene_image_refs.length === 0 || b.scene_image_refs.length === 0) {
    return <EmptyState message="Both simulations need scene images to use the overlay." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ImageStrip label={a.job_name} images={a.scene_image_refs} selected={imageA} onSelect={setImageA} />
        <ImageStrip label={b.job_name} images={b.scene_image_refs} selected={imageB} onSelect={setImageB} />
      </div>
      {imageA && imageB ? (
        <SelectedOverlay a={a} b={b} urlA={imageA} urlB={imageB} />
      ) : (
        <EmptyState message="Pick one image from each simulation to overlay." />
      )}
    </div>
  );
}
