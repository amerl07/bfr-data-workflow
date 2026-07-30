"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { PlotHoverEvent, PlotMouseEvent, PlotSelectionEvent, Data, Layout } from "plotly.js";
import type { SimRow, NumericMetricKey } from "@/lib/types";
import { METRIC_MAP } from "@/lib/metrics";
import { buildScatterColorScale } from "@/lib/colors";
import { CHART_CHROME } from "@/lib/chart-chrome";
import { useColorMode } from "@/hooks/useColorMode";
import { ScatterTooltip } from "@/components/performance/scatter-tooltip";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export type CategoricalKey =
  | "component"
  | "sweep_type"
  | "owner_initials"
  | "isolated_vs_fullcar"
  | "swept_variable";

export type SizeKey = "cell_count" | "total_df" | "total_drag";

interface ScatterPlotProps {
  rows: SimRow[];
  xKey: NumericMetricKey;
  yKey: NumericMetricKey;
  colorKey: CategoricalKey;
  sizeKey: SizeKey;
  onPointClick: (jobName: string) => void;
  onSelectionChange: (jobNames: string[]) => void;
}

export function ScatterPlot({
  rows,
  xKey,
  yKey,
  colorKey,
  sizeKey,
  onPointClick,
  onSelectionChange,
}: ScatterPlotProps) {
  const mode = useColorMode();
  const chrome = CHART_CHROME[mode];
  const [tooltip, setTooltip] = useState<{ row: SimRow; x: number; y: number } | null>(null);

  const plotted = useMemo(
    () => rows.filter((r) => r[xKey] !== null && r[yKey] !== null),
    [rows, xKey, yKey],
  );

  const { colorOf, legend } = useMemo(
    () => buildScatterColorScale(plotted.map((r) => r[colorKey] || "—"), mode),
    [plotted, colorKey, mode],
  );

  const sizeValues = useMemo(
    () =>
      plotted.map((r) => {
        const raw = r[sizeKey];
        return raw === null ? null : Math.abs(raw);
      }),
    [plotted, sizeKey],
  );
  const finiteSizes = sizeValues.filter((v): v is number => v !== null);
  const sizeMin = finiteSizes.length ? Math.min(...finiteSizes) : 0;
  const sizeMax = finiteSizes.length ? Math.max(...finiteSizes) : 1;

  function scaleSize(v: number | null): number {
    if (v === null) return 10;
    if (sizeMax === sizeMin) return 20;
    return 8 + ((v - sizeMin) / (sizeMax - sizeMin)) * 28;
  }

  const trace: Data = {
    type: "scatter",
    mode: "markers",
    x: plotted.map((r) => r[xKey] as number),
    y: plotted.map((r) => r[yKey] as number),
    hoverinfo: "none",
    marker: {
      color: plotted.map((r) => colorOf(r[colorKey] || "—")),
      size: sizeValues.map(scaleSize),
      opacity: 0.85,
      line: { width: 1, color: chrome.ring },
    },
  };

  const layout: Partial<Layout> = {
    autosize: true,
    dragmode: "select",
    hovermode: "closest",
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    showlegend: false,
    font: { family: "system-ui, -apple-system, 'Segoe UI', sans-serif", color: chrome.text, size: 12 },
    margin: { t: 10, r: 10, b: 50, l: 60 },
    xaxis: {
      title: { text: METRIC_MAP[xKey].label + (METRIC_MAP[xKey].unit ? ` (${METRIC_MAP[xKey].unit})` : "") },
      gridcolor: chrome.grid,
      zerolinecolor: chrome.axis,
      linecolor: chrome.axis,
      color: chrome.text,
    },
    yaxis: {
      title: { text: METRIC_MAP[yKey].label + (METRIC_MAP[yKey].unit ? ` (${METRIC_MAP[yKey].unit})` : "") },
      gridcolor: chrome.grid,
      zerolinecolor: chrome.axis,
      linecolor: chrome.axis,
      color: chrome.text,
    },
  };

  return (
    <div className="relative">
      <Plot
        data={[trace]}
        layout={layout}
        config={{ responsive: true, displaylogo: false, scrollZoom: true }}
        useResizeHandler
        style={{ width: "100%", height: "560px" }}
        onHover={(event: Readonly<PlotHoverEvent>) => {
          const point = event.points[0];
          if (!point) return;
          const row = plotted[point.pointIndex];
          if (!row) return;
          setTooltip({ row, x: event.event.clientX, y: event.event.clientY });
        }}
        onUnhover={() => setTooltip(null)}
        onClick={(event: Readonly<PlotMouseEvent>) => {
          const point = event.points[0];
          if (!point) return;
          const row = plotted[point.pointIndex];
          if (row) onPointClick(row.job_name);
        }}
        onSelected={(event: Readonly<PlotSelectionEvent> | undefined) => {
          if (!event) return onSelectionChange([]);
          onSelectionChange(event.points.map((p) => plotted[p.pointIndex]?.job_name).filter(Boolean));
        }}
        onDeselect={() => onSelectionChange([])}
      />

      {tooltip && <ScatterTooltip row={tooltip.row} x={tooltip.x} y={tooltip.y} />}

      {legend.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
          {legend.map((entry) => (
            <div key={entry.label} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden
              />
              <span className="text-slate-600 dark:text-slate-300">{entry.label}</span>
            </div>
          ))}
        </div>
      )}

      {rows.length > plotted.length && (
        <p className="mt-2 text-xs text-slate-400">
          {rows.length - plotted.length} simulation{rows.length - plotted.length === 1 ? "" : "s"} hidden
          (missing a value for the selected axes).
        </p>
      )}
    </div>
  );
}
