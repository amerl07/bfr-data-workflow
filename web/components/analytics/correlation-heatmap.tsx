"use client";

import { useMemo } from "react";
import type { SimRow, NumericMetricKey } from "@/lib/types";
import { METRICS } from "@/lib/metrics";
import { pearsonCorrelation } from "@/lib/stats";
import { divergingColor, textColorForBg } from "@/lib/colors";
import { useColorMode } from "@/hooks/useColorMode";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const HEATMAP_METRICS: NumericMetricKey[] = METRICS.filter((m) => m.key !== "CoP_meters").map(
  (m) => m.key,
);

export function CorrelationHeatmap({ rows }: { rows: SimRow[] }) {
  const mode = useColorMode();

  const matrix = useMemo(() => {
    return HEATMAP_METRICS.map((rowKey) =>
      HEATMAP_METRICS.map((colKey) => {
        if (rowKey === colKey) return 1;
        return pearsonCorrelation(
          rows.map((r) => r[rowKey]),
          rows.map((r) => r[colKey]),
        );
      }),
    );
  }, [rows]);

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-1" />
            {HEATMAP_METRICS.map((key) => (
              <th
                key={key}
                className="max-w-[64px] p-1 text-left font-medium text-slate-500 dark:text-slate-400"
                style={{ writingMode: "vertical-rl" }}
              >
                {METRICS.find((m) => m.key === key)?.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HEATMAP_METRICS.map((rowKey, ri) => (
            <tr key={rowKey}>
              <td className="whitespace-nowrap p-1 pr-2 text-right font-medium text-slate-500 dark:text-slate-400">
                {METRICS.find((m) => m.key === rowKey)?.label}
              </td>
              {HEATMAP_METRICS.map((colKey, ci) => {
                const value = matrix[ri][ci];
                const bg = value === null ? undefined : divergingColor(value, mode);
                return (
                  <td key={colKey} className="p-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded"
                          style={{
                            backgroundColor: bg ?? (mode === "dark" ? "#2c2c2a" : "#e1e0d9"),
                            color: bg ? textColorForBg(bg) : undefined,
                          }}
                        >
                          {value === null ? "—" : value.toFixed(2)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {METRICS.find((m) => m.key === rowKey)?.label} vs{" "}
                        {METRICS.find((m) => m.key === colKey)?.label}:{" "}
                        {value === null ? "not enough data" : value.toFixed(3)}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
