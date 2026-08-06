"use client";

import { useState } from "react";
import { driveThumbnailUrl } from "@/lib/drive";
import { Slider } from "@/components/ui/slider";

export interface OverlayImage {
  url: string;
  label: string;
}

function OpacityControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium">{label}</span>
        <span className="shrink-0 text-slate-400">{value}%</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={0} max={100} step={1} />
    </div>
  );
}

/** Stacked/centered overlay of two images with independent opacity sliders.
 * v1 intentionally does not attempt resolution/aspect-ratio alignment --
 * each image is centered and letterboxed within the same frame via
 * object-contain, which is sufficient for eyeballing differences between
 * two renders. Revisit with real alignment logic only if that turns out
 * to be insufficient in practice. */
export function ImageOverlay({ imageA, imageB }: { imageA: OverlayImage; imageB: OverlayImage }) {
  const [opacityA, setOpacityA] = useState(100);
  const [opacityB, setOpacityB] = useState(50);
  const thumbA = driveThumbnailUrl(imageA.url, 1600);
  const thumbB = driveThumbnailUrl(imageB.url, 1600);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto h-[60vh] max-h-[520px] w-full overflow-hidden rounded-lg bg-slate-950">
        {thumbA && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbA}
            alt={imageA.label}
            style={{ opacity: opacityA / 100 }}
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
        {thumbB && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbB}
            alt={imageB.label}
            style={{ opacity: opacityB / 100 }}
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <OpacityControl label={imageA.label} value={opacityA} onChange={setOpacityA} />
        <OpacityControl label={imageB.label} value={opacityB} onChange={setOpacityB} />
      </div>
    </div>
  );
}
