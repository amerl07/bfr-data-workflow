"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { DriveImage } from "@/components/shared/drive-image";
import { NumericSlider } from "@/components/shared/numeric-slider";
import { ZoomPanViewport } from "@/components/shared/zoom-pan-viewport";

export interface OverlayImage {
  url: string;
  label: string;
  /** Keys this layer's opacity. Defaults to url; pass a stable id (e.g.
   * the sim's job name) when the url changes under a layer, as in the
   * slice roller, so its slider survives the swap. */
  id?: string;
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
      <p className="mb-1 truncate text-xs font-medium">{label}</p>
      <NumericSlider
        value={value}
        onChange={onChange}
        min={0}
        max={100}
        step={1}
        unit="%"
        decrementIcon={<Minus className="h-3.5 w-3.5" />}
        incrementIcon={<Plus className="h-3.5 w-3.5" />}
        aria-label={`${label} opacity`}
      />
    </div>
  );
}

/** Stacked/centered overlay of 2+ images with independent opacity sliders.
 * images[0] is the bottom layer (fully opaque by default); every later
 * layer stacks on top at 50% by default. Opacity is keyed by url so
 * adding/removing a layer doesn't reset the others' sliders.
 * v1 intentionally does not attempt resolution/aspect-ratio alignment --
 * each image is centered and letterboxed within the same frame via
 * object-contain, which is sufficient for eyeballing differences between
 * renders. Revisit with real alignment logic only if that turns out
 * to be insufficient in practice. */
export function ImageOverlay({ images }: { images: OverlayImage[] }) {
  const [opacityOverrides, setOpacityOverrides] = useState<Record<string, number>>({});
  const layers = images.map((image, i) => {
    const key = image.id ?? image.url;
    return {
      ...image,
      key,
      opacity: opacityOverrides[key] ?? (i === 0 ? 100 : 50),
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <ZoomPanViewport frameClassName="h-[60vh] max-h-[520px]">
        {layers.map((layer) => (
          <DriveImage
            // Keyed by url (not layer.key) so a swapped image gets a fresh retry count.
            key={layer.url}
            url={layer.url}
            size={1600}
            alt={layer.label}
            style={{ opacity: layer.opacity / 100 }}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ))}
      </ZoomPanViewport>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {layers.map((layer) => (
          <OpacityControl
            key={layer.key}
            label={layer.label}
            value={layer.opacity}
            onChange={(v) => setOpacityOverrides((prev) => ({ ...prev, [layer.key]: v }))}
          />
        ))}
      </div>
    </div>
  );
}
