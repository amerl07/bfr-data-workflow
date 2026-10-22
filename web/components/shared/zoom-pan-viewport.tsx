"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { NumericSlider } from "@/components/shared/numeric-slider";
import { cn } from "@/lib/utils";

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

/** A frame whose contents zoom (wheel or slider) and pan (drag, once zoomed
 * past 100%), with a zoom slider underneath. Children are absolutely
 * positioned layers filling the frame. Zoom and pan live here, so swapping
 * the children (e.g. stepping to another slice) keeps the current view. */
export function ZoomPanViewport({
  children,
  frameClassName,
}: {
  children: ReactNode;
  /** Sizing for the frame, e.g. a fixed height or an aspect ratio. */
  frameClassName: string;
}) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(null);

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
          "relative mx-auto w-full overflow-hidden rounded-lg bg-slate-950",
          frameClassName,
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
          {children}
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
    </div>
  );
}
