"use client";

import { useMemo } from "react";
import { useSimulations } from "@/hooks/useSimulations";
import { countBy } from "@/lib/stats";
import { StatCards } from "@/components/analytics/stat-cards";
import { CategoryBarChart } from "@/components/analytics/category-bar-chart";
import { TimelineChart } from "@/components/analytics/timeline-chart";
import { HistogramChart } from "@/components/analytics/histogram-chart";
import { CorrelationHeatmap } from "@/components/analytics/correlation-heatmap";
import { Leaderboards } from "@/components/analytics/leaderboards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/status";

export function AnalyticsView() {
  const { data: rows, isLoading, error } = useSimulations();

  const componentCounts = useMemo(
    () => (rows ? countBy(rows, (r) => r.component).sort((a, b) => b.count - a.count) : []),
    [rows],
  );
  const sweepTypeCounts = useMemo(
    () => (rows ? countBy(rows, (r) => r.sweep_type).sort((a, b) => b.count - a.count) : []),
    [rows],
  );
  const ownerCounts = useMemo(
    () => (rows ? countBy(rows, (r) => r.owner_initials).sort((a, b) => b.count - a.count) : []),
    [rows],
  );
  const timeline = useMemo(
    () =>
      rows
        ? countBy(rows.filter((r) => r.date), (r) => r.date)
            .map((d) => ({ date: d.label, count: d.count }))
            .sort((a, b) => a.date.localeCompare(b.date))
        : [],
    [rows],
  );

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;
  if (!rows) return null;

  const numeric = (key: "total_df" | "total_drag" | "CoP" | "cell_count") =>
    rows.map((r) => r[key]).filter((v): v is number => v !== null);

  return (
    <div className="flex flex-col gap-8 pb-12">
      <StatCards rows={rows} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Component Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={componentCounts} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sweep Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={sweepTypeCounts} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Owner Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={ownerCounts} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Simulations Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <TimelineChart data={timeline} />
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Performance Distribution</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Total DF (N)</CardTitle>
            </CardHeader>
            <CardContent>
              <HistogramChart values={numeric("total_df")} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Drag (N)</CardTitle>
            </CardHeader>
            <CardContent>
              <HistogramChart values={numeric("total_drag")} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>CoP (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <HistogramChart values={numeric("CoP")} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cell Count</CardTitle>
            </CardHeader>
            <CardContent>
              <HistogramChart values={numeric("cell_count")} />
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Correlation Matrix</h2>
        <Card>
          <CardContent className="pt-4">
            <CorrelationHeatmap rows={rows} />
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Top Performers</h2>
        <Leaderboards rows={rows} />
      </section>
    </div>
  );
}
