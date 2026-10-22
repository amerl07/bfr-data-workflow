"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff } from "lucide-react";
import { driveThumbnailUrl, driveViewUrl } from "@/lib/drive";
import { useDriveFileNames } from "@/hooks/useDriveFileNames";
import { formatSlicePosition, slicePositions, velocitySlices, type SliceAxis } from "@/lib/slices";
import { Slider } from "@/components/ui/slider";
import { ImageOverlay } from "@/components/shared/image-overlay";
import { DriveImage } from "@/components/shared/drive-image";
import { ZoomPanViewport } from "@/components/shared/zoom-pan-viewport";
import { EmptyState } from "@/components/status";
import { cn } from "@/lib/utils";

export interface SliceRollerSim {
  /** Stable id (the job name). */
  key: string;
  /** Short tag like "A"; when set, panels are headed "A · <key>" and
   * overlay layers "A · <filename>". Omit for a single sim. */
  tag?: string;
  urls: string[];
}

type ViewMode = "side-by-side" | "overlay";

const AXES: SliceAxis[] = ["X", "Y", "Z"];
const THUMB_SIZE = 1600;

function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-300 text-xs dark:border-slate-700">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-2.5 py-1",
            o.value === value
              ? "bg-blue-600 text-white"
              : "hover:bg-slate-100 dark:hover:bg-slate-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SlicePanel({
  label,
  url,
  name,
  missingLabel,
  zoomable,
}: {
  label?: string;
  url: string | null;
  name: string | null;
  missingLabel: string;
  /** Wheel/slider zoom and drag-to-pan; the view is kept while stepping slices. */
  zoomable: boolean;
}) {
  const content = url ? (
    <DriveImage
      key={url}
      url={url}
      size={THUMB_SIZE}
      alt={name ?? "Slice"}
      className="h-full w-full object-contain"
      fallback={
        <a
          href={driveViewUrl(url)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
        >
          <ImageOff className="h-5 w-5" />
          Open in Drive
        </a>
      }
    />
  ) : (
    <span className="text-xs text-slate-400">{missingLabel}</span>
  );

  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
      {label && (
        <p className="mb-2 truncate text-xs font-medium" title={label}>
          {label}
        </p>
      )}
      {zoomable ? (
        <ZoomPanViewport frameClassName="aspect-video">
          <div className="absolute inset-0 flex items-center justify-center">{content}</div>
        </ZoomPanViewport>
      ) : (
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-slate-950">
          {content}
        </div>
      )}
      {url && name && (
        <a
          href={driveViewUrl(url)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1 truncate font-mono text-xs text-slate-600 hover:text-blue-600 dark:text-slate-300"
          title={`Open ${name} in Drive`}
        >
          <span className="truncate">{name}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      )}
    </div>
  );
}

/** Steps through each sim's Velocity_{X,Y,Z} slice images with one shared
 * position, so the same slice is shown for every sim at once. Slices are
 * found by Drive filename (see lib/slices.ts), so nothing renders until
 * names resolve, and the whole section is hidden when no sim has slices.
 * Positions step in sorted order; uneven spacing is not represented. */
export function SliceRoller({
  title,
  sims,
  overlayOrder,
}: {
  title: string;
  sims: SliceRollerSim[];
  /** Sim keys bottom-to-top for overlay mode (baseline first); defaults to sims order. */
  overlayOrder?: string[];
}) {
  const names = useDriveFileNames(sims.flatMap((s) => s.urls));
  const sliceSets = sims.map((s) => velocitySlices(s.urls, names));
  const axes = AXES.filter((a) => sliceSets.some((set) => set.some((s) => s.axis === a)));

  const [axisChoice, setAxisChoice] = useState<SliceAxis | null>(null);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<ViewMode>("side-by-side");

  const axis = axisChoice && axes.includes(axisChoice) ? axisChoice : axes[0];
  const positions = axis ? slicePositions(sliceSets, axis) : [];
  const current = Math.min(index, Math.max(0, positions.length - 1));
  const position = positions[current];

  function sliceAt(simIndex: number, i: number) {
    const pos = positions[i];
    return sliceSets[simIndex].find((s) => s.axis === axis && s.position === pos) ?? null;
  }

  // Warm the browser cache for the neighbouring slices so stepping is instant.
  const neighbourThumbs = [current - 1, current + 1]
    .filter((i) => i >= 0 && i < positions.length)
    .flatMap((i) => sims.map((_, s) => sliceAt(s, i)?.url))
    .filter((u): u is string => !!u)
    .map((u) => driveThumbnailUrl(u, THUMB_SIZE))
    .join("|");
  useEffect(() => {
    if (!neighbourThumbs) return;
    for (const src of neighbourThumbs.split("|")) new Image().src = src;
  }, [neighbourThumbs]);

  if (axes.length === 0 || position === undefined) return null;

  // Functional update so several steps between renders (fast clicks or a
  // held arrow key) each count.
  const last = positions.length - 1;
  const step = (delta: number) => setIndex((i) => Math.min(last, Math.max(0, Math.min(i, last) + delta)));
  const missingLabel = `No slice at ${formatSlicePosition(axis, position)}`;
  const panels = sims.map((sim, i) => ({ sim, slice: sliceAt(i, current) }));
  const overlayLayers = (overlayOrder ?? sims.map((s) => s.key))
    .map((key) => panels.find((p) => p.sim.key === key))
    .filter((p): p is (typeof panels)[number] => !!p?.slice)
    .map(({ sim, slice }) => ({
      id: sim.key,
      url: slice!.url,
      label: sim.tag ? `${sim.tag} · ${slice!.name}` : slice!.name,
    }));

  return (
    <section
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") step(-1);
        else if (e.key === "ArrowRight") step(1);
        else return;
        e.preventDefault();
      }}
      className="rounded-lg focus:outline-none"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {axes.length > 1 && (
            <SegmentedToggle
              options={axes.map((a) => ({ value: a, label: `${a} slices` }))}
              value={axis}
              onChange={(a) => {
                setAxisChoice(a);
                setIndex(0);
              }}
            />
          )}
          {sims.length > 1 && (
            <SegmentedToggle<ViewMode>
              options={[
                { value: "side-by-side", label: "Side by side" },
                { value: "overlay", label: "Overlay" },
              ]}
              value={mode}
              onChange={setMode}
            />
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={current === 0}
          aria-label="Previous slice"
          className="rounded-md border border-slate-300 p-1 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Slider
          value={[current]}
          onValueChange={([v]) => setIndex(v)}
          min={0}
          max={Math.max(0, positions.length - 1)}
          step={1}
          disabled={positions.length < 2}
          aria-label="Slice position"
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={current === positions.length - 1}
          aria-label="Next slice"
          className="rounded-md border border-slate-300 p-1 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="w-36 shrink-0 text-right text-sm font-medium tabular-nums">
          {formatSlicePosition(axis, position)}
          <span className="ml-1 text-xs font-normal text-slate-400">
            ({current + 1}/{positions.length})
          </span>
        </span>
      </div>

      {mode === "overlay" && sims.length > 1 ? (
        overlayLayers.length >= 2 ? (
          <ImageOverlay images={overlayLayers} />
        ) : (
          <EmptyState message={`Fewer than two simulations have a slice at ${formatSlicePosition(axis, position)}.`} />
        )
      ) : (
        <div
          className={cn(
            "grid gap-3",
            sims.length === 1 ? "grid-cols-1 lg:mx-auto lg:max-w-4xl" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {panels.map(({ sim, slice }, i) => (
            <SlicePanel
              key={sim.key}
              label={sim.tag ? `${sim.tag} · ${sim.key}` : undefined}
              url={slice?.url ?? null}
              name={slice?.name ?? null}
              missingLabel={sliceSets[i].length === 0 ? "No Velocity slices in this run" : missingLabel}
              // Single-sim only: side-by-side panels stay fixed so they line up.
              zoomable={sims.length === 1}
            />
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">
        Click the roller, then use ← / → to step through slices.
        {sims.length === 1 && " Scroll over the image to zoom; drag to pan once zoomed in."}
      </p>
    </section>
  );
}
