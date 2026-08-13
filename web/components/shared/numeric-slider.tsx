"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/** Slider paired with -/+ step buttons and a typeable number field, so a
 * value can be set by dragging, discrete clicking, or typing digits. */
export function NumericSlider({
  value,
  onChange,
  min,
  max,
  step,
  unit = "",
  decrementIcon,
  incrementIcon,
  className,
  sliderClassName = "w-28",
  inputClassName = "w-12",
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decrementIcon: ReactNode;
  incrementIcon: ReactNode;
  className?: string;
  sliderClassName?: string;
  inputClassName?: string;
  "aria-label"?: string;
}) {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  function clamp(n: number) {
    return Math.min(max, Math.max(min, n));
  }

  function commitInput() {
    const parsed = Number(inputValue);
    if (Number.isFinite(parsed)) {
      onChange(clamp(parsed));
    } else {
      setInputValue(String(value));
    }
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label={ariaLabel ? `Decrease ${ariaLabel}` : "Decrease"}
        className="shrink-0 text-slate-400 hover:text-slate-600 disabled:opacity-40 disabled:hover:text-slate-400 dark:hover:text-slate-200 dark:disabled:hover:text-slate-400"
      >
        {decrementIcon}
      </button>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className={sliderClassName}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label={ariaLabel ? `Increase ${ariaLabel}` : "Increase"}
        className="shrink-0 text-slate-400 hover:text-slate-600 disabled:opacity-40 disabled:hover:text-slate-400 dark:hover:text-slate-200 dark:disabled:hover:text-slate-400"
      >
        {incrementIcon}
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={commitInput}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label={ariaLabel ? `${ariaLabel} value` : undefined}
        className={cn(
          "shrink-0 rounded border border-slate-300 bg-transparent px-1 py-0.5 text-right text-xs tabular-nums dark:border-slate-700",
          inputClassName,
        )}
      />
      {unit && <span className="shrink-0 text-xs text-slate-400">{unit}</span>}
    </div>
  );
}
