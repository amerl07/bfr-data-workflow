"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, ZoomIn, ZoomOut } from "lucide-react";
import { DriveImage } from "@/components/shared/drive-image";
import { NumericSlider } from "@/components/shared/numeric-slider";
import { cn } from "@/lib/utils";

export interface OverlayImage {
  url: string;
  label: string;
  /** Keys this layer's opacity. Defaults to url; pass a stable id (e.g.
   * the sim's job name) when the url changes under a layer, as in the
   * slice roller, so its slider survives the swap. */
  id?: string;
}

const MIN_ZOOM = 50;
const MAX_ZOOM = 400;
const DEFAULT_ZOOM = 100;
const WHEEL_ZOOM_STEP = 10;

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Pan is only meaningful once the image is scaled past the container, so
 * bounds shrink to zero at/under 100% zoom -- keeps the image centered
 * instead of letting it drift while zoomed out or at 1:1. */
function clampPan(x: number, y: number, zoom: number, rect: { width: number; height: number }) {
  const maxX = Math.max(0, (rect.width * (zoom / 100 - 1)) / 2);
  const maxY = Math.max(0, (rect.height * (zoom / 100 - 1)) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
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
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(null);
  const layers = images.map((image, i) => {
    const key = image.id ?? image.url;
    return {
      ...image,
      key,
      opacity: opacityOverrides[key] ?? (i === 0 ? 100 : 50),
    };
  });

  // Re-clamp pan whenever zoom changes (slider/stepper/typed/wheel), so
  // zooming back out snaps the image back into bounds instead of leaving
  // it stranded off-center.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPan((p) => clampPan(p.x, p.y, zoom, rect));
  }, [zoom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setZoom((z) => clampZoom(z + (e.deltaY > 0 ? -WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP)));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMouseMove(e: MouseEvent) {
      const el = containerRef.current;
      if (!el || !dragStart.current) return;
      const rect = el.getBoundingClientRect();
      const { mouseX, mouseY, panX, panY } = dragStart.current;
      setPan(clampPan(panX + (e.clientX - mouseX), panY + (e.clientY - mouseY), zoom, rect));
    }
    function onMouseUp() {
      dragStart.current = null;
      setDragging(false);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, zoom]);

  function handleMouseDown(e: React.MouseEvent) {
    if (zoom <= 100) return;
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onDragStart={(e) => e.preventDefault()}
        className={cn(
          "relative mx-auto h-[60vh] max-h-[520px] w-full overflow-hidden rounded-lg bg-slate-950",
          zoom > 100 && (dragging ? "cursor-grabbing" : "cursor-grab"),
        )}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
            transformOrigin: "center",
          }}
        >
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
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium">Zoom</p>
        <NumericSlider
          value={zoom}
          onChange={setZoom}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={10}
          unit="%"
          decrementIcon={<ZoomOut className="h-3.5 w-3.5" />}
          incrementIcon={<ZoomIn className="h-3.5 w-3.5" />}
          aria-label="Zoom"
        />
      </div>
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
