"use client";

import { METRICS } from "@/lib/metrics";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CategoricalKey, SizeKey } from "@/components/performance/scatter-plot";

const CATEGORICAL_OPTIONS: { key: CategoricalKey; label: string }[] = [
  { key: "component", label: "Component" },
  { key: "sweep_type", label: "Sweep Type" },
  { key: "owner_initials", label: "Owner" },
  { key: "isolated_vs_fullcar", label: "Isolated vs Full Car" },
  { key: "swept_variable", label: "Swept Variable" },
];

const SIZE_OPTIONS: { key: SizeKey; label: string }[] = [
  { key: "cell_count", label: "Cell Count" },
  { key: "total_df", label: "Total DF" },
  { key: "total_drag", label: "Total Drag" },
];

interface AxisControlsProps {
  xKey: string;
  yKey: string;
  colorKey: CategoricalKey;
  sizeKey: SizeKey;
  onChange: (next: { x?: string; y?: string; color?: CategoricalKey; size?: SizeKey }) => void;
}

function Field({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AxisControls({ xKey, yKey, colorKey, sizeKey, onChange }: AxisControlsProps) {
  const metricOptions = METRICS.map((m) => ({ key: m.key, label: m.label }));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Field label="X-axis" value={xKey} onChange={(v) => onChange({ x: v })} options={metricOptions} />
      <Field label="Y-axis" value={yKey} onChange={(v) => onChange({ y: v })} options={metricOptions} />
      <Field
        label="Color"
        value={colorKey}
        onChange={(v) => onChange({ color: v as CategoricalKey })}
        options={CATEGORICAL_OPTIONS}
      />
      <Field
        label="Marker Size"
        value={sizeKey}
        onChange={(v) => onChange({ size: v as SizeKey })}
        options={SIZE_OPTIONS}
      />
    </div>
  );
}
