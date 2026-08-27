"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ExternalLink, ImageOff, Layers, Search, X, ZoomIn, ZoomOut } from "lucide-react";
import { driveThumbnailUrl, driveViewUrl } from "@/lib/drive";
import { useDriveFileName } from "@/hooks/useDriveFileName";
import { useDriveFileNames } from "@/hooks/useDriveFileNames";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NameSortToggle, type NameSortDirection } from "@/components/detail/name-sort-toggle";
import { NumericSlider } from "@/components/shared/numeric-slider";
import { ImageOverlay } from "@/components/shared/image-overlay";
import { EmptyState } from "@/components/status";
import { cn } from "@/lib/utils";

const MIN_THUMB_SIZE = 90;
const MAX_THUMB_SIZE = 260;
const DEFAULT_THUMB_SIZE = 150;

function GalleryThumb({
  url,
  label,
  compareMode,
  selected,
  onOpen,
  onToggleSelect,
}: {
  url: string;
  label: string;
  compareMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
}) {
  const [error, setError] = useState(false);
  const thumb = driveThumbnailUrl(url);

  if (!thumb || error) {
    return (
      <a
        href={driveViewUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 dark:border-slate-700"
      >
        <ImageOff className="h-5 w-5" />
        <span className="text-[10px]">Open in Drive</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={compareMode ? onToggleSelect : onOpen}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800",
        compareMode && selected && "ring-2 ring-blue-600",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb}
        alt="Scene"
        loading="lazy"
        onError={() => setError(true)}
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
      />
      <span className="pointer-events-none absolute left-1 top-1 max-w-[calc(100%-0.5rem)] truncate rounded bg-black/70 px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight text-white">
        {label}
      </span>
      {compareMode && selected && (
        <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
          <Check className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}

function SelectedOverlay({ images, urls }: { images: string[]; urls: [string, string] }) {
  const indexA = images.indexOf(urls[0]);
  const indexB = images.indexOf(urls[1]);
  const { data: nameA } = useDriveFileName(urls[0], true);
  const { data: nameB } = useDriveFileName(urls[1], true);

  return (
    <ImageOverlay
      imageA={{ url: urls[0], label: nameA || `Image ${indexA + 1}` }}
      imageB={{ url: urls[1], label: nameB || `Image ${indexB + 1}` }}
    />
  );
}

export function SceneGallery({
  images,
  selectionLimit = 2,
  selectLabel = "Compare 2 images",
  onSelectionChange,
}: {
  images: string[];
  /** Max images selectable in compare mode. 2 (default) shows an inline
   * overlay comparison between two images from this gallery. 1 is for a
   * caller that combines the pick with a selection from elsewhere (e.g.
   * comparing one image from each of two simulations). */
  selectionLimit?: number;
  selectLabel?: string;
  onSelectionChange?: (selected: string[]) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [thumbSize, setThumbSize] = useState(DEFAULT_THUMB_SIZE);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<NameSortDirection>("asc");

  // Fetched eagerly (not lazily on hover) so the gallery can be sorted by
  // name up front and searched -- see useDriveFileNames' comment on the
  // API-quota tradeoff this makes vs. the hover-only useDriveFileName.
  const names = useDriveFileNames(images);

  // Notify the parent from an effect, not from inside the setSelected
  // updater -- calling a different component's setState mid-render (which
  // functional updaters run under) trips React's cross-component update
  // warning.
  useEffect(() => {
    onSelectionChange?.(selected);
  }, [selected, onSelectionChange]);

  // Sorted alphabetically by resolved name (direction toggleable); images
  // whose name hasn't resolved yet always sort after every resolved one,
  // in their original order, regardless of direction -- so they don't jump
  // around based on meaningless "Image N" text (e.g. "Image 10" would
  // otherwise sort before "Image 2"), they just settle into their real
  // alphabetical position as soon as the name arrives.
  const sorted = useMemo(() => {
    const withMeta = images.map((url, index) => ({ url, index, name: names[url] ?? null }));
    return withMeta.sort((a, b) => {
      if (a.name && b.name) {
        const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        return sortDirection === "asc" ? cmp : -cmp;
      }
      if (a.name && !b.name) return -1;
      if (!a.name && b.name) return 1;
      return a.index - b.index;
    });
  }, [images, names, sortDirection]);

  const entries = useMemo(() => {
    const labeled = sorted.map((e) => ({ ...e, label: e.name ?? `Image ${e.index + 1}` }));
    const q = query.trim().toLowerCase();
    if (!q) return labeled;
    return labeled.filter((e) => e.label.toLowerCase().includes(q));
  }, [sorted, query]);

  if (images.length === 0) {
    return <EmptyState message="No scene images for this simulation." />;
  }

  function toggleSelect(url: string) {
    setSelected((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (prev.length >= selectionLimit) return selectionLimit === 1 ? [url] : prev;
      return [...prev, url];
    });
  }

  function exitCompareMode() {
    setCompareMode(false);
    setSelected([]);
  }

  const current = openIndex !== null ? entries[openIndex]?.url ?? null : null;
  const currentThumb = current ? driveThumbnailUrl(current, 1600) : null;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <NumericSlider
            value={thumbSize}
            onChange={setThumbSize}
            min={MIN_THUMB_SIZE}
            max={MAX_THUMB_SIZE}
            step={10}
            unit="px"
            decrementIcon={<ZoomOut className="h-4 w-4" />}
            incrementIcon={<ZoomIn className="h-4 w-4" />}
            aria-label="Thumbnail size"
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by image name"
              className="h-8 w-48 pl-8 text-xs"
            />
          </div>
          <NameSortToggle direction={sortDirection} onChange={setSortDirection} />
        </div>

        {compareMode ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              Select {selectionLimit} image{selectionLimit === 1 ? "" : "s"} ({selected.length}/{selectionLimit})
            </span>
            <button
              type="button"
              onClick={exitCompareMode}
              className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCompareMode(true)}
            className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <Layers className="h-3 w-3" /> {selectLabel}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState message={`No images match "${query}".`} />
      ) : (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))` }}
        >
          {entries.map((entry, i) => (
            <GalleryThumb
              key={entry.url + entry.index}
              url={entry.url}
              label={entry.label}
              compareMode={compareMode}
              selected={selected.includes(entry.url)}
              onOpen={() => setOpenIndex(i)}
              onToggleSelect={() => toggleSelect(entry.url)}
            />
          ))}
        </div>
      )}

      {compareMode && selectionLimit >= 2 && selected.length === selectionLimit && (
        <div className="mt-6 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="mb-3 text-sm font-semibold">Overlay Comparison</h3>
          <SelectedOverlay images={images} urls={[selected[0], selected[1]]} />
        </div>
      )}

      <Dialog open={openIndex !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="max-w-4xl bg-black p-0">
          <DialogTitle className="sr-only">
            Scene image {openIndex !== null ? openIndex + 1 : ""}
          </DialogTitle>
          {currentThumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentThumb} alt="Scene full size" className="max-h-[85vh] w-full object-contain" />
          )}
          {current && (
            <a
              href={driveViewUrl(current)}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 right-3 flex items-center gap-1 rounded bg-white/90 px-2 py-1 text-xs font-medium text-slate-900"
            >
              <ExternalLink className="h-3 w-3" /> Open in Drive
            </a>
          )}
          {openIndex !== null && openIndex > 0 && (
            <button
              type="button"
              onClick={() => setOpenIndex((i) => (i !== null ? i - 1 : i))}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {openIndex !== null && openIndex < entries.length - 1 && (
            <button
              type="button"
              onClick={() => setOpenIndex((i) => (i !== null ? i + 1 : i))}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
