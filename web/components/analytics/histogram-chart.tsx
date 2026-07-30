"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useColorMode } from "@/hooks/useColorMode";
import { CATEGORICAL_LIGHT, CATEGORICAL_DARK } from "@/lib/colors";
import { CHART_CHROME } from "@/lib/chart-chrome";
import { histogram } from "@/lib/stats";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/status";

export function HistogramChart({ values }: { values: number[] }) {
  const mode = useColorMode();
  const chrome = CHART_CHROME[mode];
  const seriesColor = mode === "dark" ? CATEGORICAL_DARK[0] : CATEGORICAL_LIGHT[0];

  const buckets = histogram(values, 10);
  if (buckets.length === 0) return <EmptyState message="No data yet." />;

  const data = buckets.map((b) => ({
    range: `${formatNumber(b.min, { digits: 1 })}–${formatNumber(b.max, { digits: 1 })}`,
    count: b.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={chrome.grid} vertical={false} />
        <XAxis
          dataKey="range"
          tick={{ fill: chrome.text, fontSize: 10 }}
          axisLine={{ stroke: chrome.axis }}
          tickLine={false}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={50}
        />
        <YAxis
          tick={{ fill: chrome.text, fontSize: 12 }}
          axisLine={{ stroke: chrome.axis }}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: chrome.surface,
            border: `1px solid ${chrome.grid}`,
            borderRadius: 6,
            fontSize: 12,
            color: chrome.textPrimary,
          }}
        />
        <Bar dataKey="count" fill={seriesColor} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
