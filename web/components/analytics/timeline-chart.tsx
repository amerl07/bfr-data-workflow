"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useColorMode } from "@/hooks/useColorMode";
import { CATEGORICAL_LIGHT, CATEGORICAL_DARK } from "@/lib/colors";
import { CHART_CHROME } from "@/lib/chart-chrome";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/status";

export function TimelineChart({ data }: { data: { date: string; count: number }[] }) {
  const mode = useColorMode();
  const chrome = CHART_CHROME[mode];
  const seriesColor = mode === "dark" ? CATEGORICAL_DARK[0] : CATEGORICAL_LIGHT[0];

  if (data.length === 0) return <EmptyState message="No data yet." />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={chrome.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fill: chrome.text, fontSize: 12 }}
          axisLine={{ stroke: chrome.axis }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: chrome.text, fontSize: 12 }}
          axisLine={{ stroke: chrome.axis }}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          labelFormatter={(v) => formatDate(String(v))}
          contentStyle={{
            background: chrome.surface,
            border: `1px solid ${chrome.grid}`,
            borderRadius: 6,
            fontSize: 12,
            color: chrome.textPrimary,
          }}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke={seriesColor}
          strokeWidth={2}
          dot={{ r: 3, fill: seriesColor }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
