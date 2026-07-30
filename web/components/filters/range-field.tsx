"use client";

import { Slider } from "@/components/ui/slider";
import { formatNumber } from "@/lib/format";

interface RangeFieldProps {
  label: string;
  unit?: string;
  bounds: [number, number] | null;
  value: [number, number] | null;
  onChange: (next: [number, number] | null) => void;
}

export function RangeField({ label, unit, bounds, value, onChange }: RangeFieldProps) {
  if (!bounds) {
    return (
      <div>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <p className="mt-1 text-xs text-slate-400">No data yet</p>
      </div>
    );
  }

  const [min, max] = bounds;
  const current = value ?? bounds;
  const step = max > min ? (max - min) / 100 : 1;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            reset
          </button>
        )}
      </div>
      {min === max ? (
        <p className="text-xs text-slate-400">
          Only one value in data: {formatNumber(min, { unit })}
        </p>
      ) : (
        <>
          <Slider
            min={min}
            max={max}
            step={step || 1}
            value={current}
            onValueChange={(v) => onChange([v[0], v[1]] as [number, number])}
          />
          <div className="mt-1.5 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{formatNumber(current[0], { unit })}</span>
            <span>{formatNumber(current[1], { unit })}</span>
          </div>
        </>
      )}
    </div>
  );
}
