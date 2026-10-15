"use client";

import { useCallback, useState } from "react";
import type { SimRow } from "@/lib/types";
import { SceneGallery } from "@/components/detail/scene-gallery";
import { useDriveFileNames } from "@/hooks/useDriveFileNames";
import { ImageOverlay } from "@/components/shared/image-overlay";
import { EmptyState } from "@/components/status";

interface Pick {
  row: SimRow;
  letter: string;
  url: string;
}

function SelectedOverlay({ picks }: { picks: Pick[] }) {
  const names = useDriveFileNames(picks.map((p) => p.url));

  return (
    <ImageOverlay
      images={picks.map((p) => ({
        url: p.url,
        label: `${p.letter} · ${names[p.url] || p.row.job_name}`,
      }))}
    />
  );
}

function SimGallery({
  row,
  letter,
  onPick,
}: {
  row: SimRow;
  letter: string;
  onPick: (jobName: string, url: string | null) => void;
}) {
  const handleSelectionChange = useCallback(
    (sel: string[]) => onPick(row.job_name, sel[0] ?? null),
    [onPick, row.job_name],
  );

  return (
    <div className="w-[min(30rem,85vw)] shrink-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-3 truncate border-b border-slate-200 pb-2 text-sm font-medium dark:border-slate-800" title={row.job_name}>
        <span className="text-slate-400">{letter} · </span>
        {row.job_name}
      </p>
      {row.scene_image_refs.length === 0 ? (
        <p className="text-sm text-slate-400">No scene images</p>
      ) : (
        <SceneGallery
          images={row.scene_image_refs}
          selectionLimit={1}
          selectLabel="Select for overlay"
          defaultCompareMode
          // 140px fits exactly 3 thumbnails per row in the 30rem panel.
          defaultThumbSize={140}
          onSelectionChange={handleSelectionChange}
        />
      )}
    </div>
  );
}

/** One scene gallery per compared simulation, plus an overlay built from
 * them: toggle "Select for overlay" in any gallery and pick one image. Every
 * simulation with a picked image becomes one layer, with the baseline's
 * image always on the bottom (fully opaque by default) and the rest stacked
 * on top in picker order -- so any 2+ of the N sims can be overlaid, and a
 * layer can be hidden by dragging its opacity to 0 instead of un-picking. */
export function CompareGalleries({ rows, baseline }: { rows: SimRow[]; baseline: SimRow }) {
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const handlePick = useCallback((jobName: string, url: string | null) => {
    setPicked((prev) => (prev[jobName] === url ? prev : { ...prev, [jobName]: url }));
  }, []);

  if (rows.every((r) => r.scene_image_refs.length === 0)) {
    return <EmptyState message="None of these simulations have scene images." />;
  }

  const lettered = rows.map((row, i) => ({ row, letter: String.fromCharCode(65 + i) }));
  const picks: Pick[] = [
    ...lettered.filter((l) => l.row.job_name === baseline.job_name),
    ...lettered.filter((l) => l.row.job_name !== baseline.job_name),
  ]
    .map((l) => ({ ...l, url: picked[l.row.job_name] ?? "" }))
    .filter((p) => p.url);

  return (
    <div className="flex flex-col gap-6">
      {/* One fixed-width column per sim in a single row that scrolls
          sideways, rather than wrapping galleries onto new rows. */}
      <div className="flex gap-4 overflow-x-auto pb-3">
        {lettered.map(({ row, letter }) => (
          <SimGallery key={row.job_name} row={row} letter={letter} onPick={handlePick} />
        ))}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Overlay Comparison</h3>
        {picks.length >= 2 ? (
          <SelectedOverlay picks={picks} />
        ) : (
          <EmptyState message='Click "Select for overlay" in two or more galleries above and pick one image from each simulation. The baseline sits on the bottom layer.' />
        )}
      </div>
    </div>
  );
}
