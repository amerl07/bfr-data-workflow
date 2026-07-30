"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff } from "lucide-react";
import { driveThumbnailUrl, driveViewUrl } from "@/lib/drive";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/status";

function GalleryThumb({ url, onClick }: { url: string; onClick: () => void }) {
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
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb}
        alt="Scene"
        loading="lazy"
        onError={() => setError(true)}
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
      />
    </button>
  );
}

export function SceneGallery({ images }: { images: string[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return <EmptyState message="No scene images for this simulation." />;
  }

  const current = openIndex !== null ? images[openIndex] : null;
  const currentThumb = current ? driveThumbnailUrl(current, 1600) : null;

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {images.map((url, i) => (
          <GalleryThumb key={url + i} url={url} onClick={() => setOpenIndex(i)} />
        ))}
      </div>

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
          {openIndex !== null && openIndex < images.length - 1 && (
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
