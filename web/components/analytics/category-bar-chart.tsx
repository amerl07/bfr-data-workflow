"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useColorMode } from "@/hooks/useColorMode";
import { CATEGORICAL_LIGHT, CATEGORICAL_DARK } from "@/lib/colors";
import { CHART_CHROME } from "@/lib/chart-chrome";
import { EmptyState } from "@/components/status";

export function CategoryBarChart({ data }: { data: { label: string; count: number }[] }) {
  const mode = useColorMode();
  const chrome = CHART_CHROME[mode];
  const seriesColor = mode === "dark" ? CATEGORICAL_DARK[0] : CATEGORICAL_LIGHT[0];

  if (data.length === 0) return <EmptyState message="No data yet." />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={chrome.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: chrome.text, fontSize: 12 }}
          axisLine={{ stroke: chrome.axis }}
          tickLine={false}
          interval={0}
          angle={data.length > 6 ? -25 : 0}
          textAnchor={data.length > 6 ? "end" : "middle"}
          height={data.length > 6 ? 50 : 24}
        />
        <YAxis
          tick={{ fill: chrome.text, fontSize: 12 }}
          axisLine={{ stroke: chrome.axis }}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: chrome.grid }}
          contentStyle={{
            background: chrome.surface,
            border: `1px solid ${chrome.grid}`,
            borderRadius: 6,
            fontSize: 12,
            color: chrome.textPrimary,
          }}
        />
        <Bar dataKey="count" fill={seriesColor} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
