"use client";

import { useCallback, useState } from "react";
import type { SimRow } from "@/lib/types";
import { SceneGallery } from "@/components/detail/scene-gallery";
import { useDriveFileName } from "@/hooks/useDriveFileName";
import { ImageOverlay } from "@/components/shared/image-overlay";
import { EmptyState } from "@/components/status";

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

/** Per-simulation scene galleries with hover-to-preview names, plus an
 * overlay comparison built directly from the galleries: toggle "Select for
 * overlay" in each gallery and pick one image per side, mirroring how the
 * sim detail page's gallery lets you pick images to compare in place. */
export function CompareGalleries({ a, b }: { a: SimRow; b: SimRow }) {
  const [imageA, setImageA] = useState<string | null>(null);
  const [imageB, setImageB] = useState<string | null>(null);
  const handleSelectionChangeA = useCallback((sel: string[]) => setImageA(sel[0] ?? null), []);
  const handleSelectionChangeB = useCallback((sel: string[]) => setImageB(sel[0] ?? null), []);

  if (a.scene_image_refs.length === 0 && b.scene_image_refs.length === 0) {
    return <EmptyState message="Neither simulation has scene images." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 truncate text-sm font-medium">{a.job_name}</p>
          {a.scene_image_refs.length === 0 ? (
            <p className="text-sm text-slate-400">No scene images</p>
          ) : (
            <SceneGallery
              images={a.scene_image_refs}
              selectionLimit={1}
              selectLabel="Select for overlay"
              onSelectionChange={handleSelectionChangeA}
            />
          )}
        </div>
        <div>
          <p className="mb-2 truncate text-sm font-medium">{b.job_name}</p>
          {b.scene_image_refs.length === 0 ? (
            <p className="text-sm text-slate-400">No scene images</p>
          ) : (
            <SceneGallery
              images={b.scene_image_refs}
              selectionLimit={1}
              selectLabel="Select for overlay"
              onSelectionChange={handleSelectionChangeB}
            />
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Overlay Comparison</h3>
        {imageA && imageB ? (
          <SelectedOverlay a={a} b={b} urlA={imageA} urlB={imageB} />
        ) : (
          <EmptyState message='Click "Select for overlay" in each gallery above and pick one image from each simulation.' />
        )}
      </div>
    </div>
  );
}
