"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSimulations } from "@/hooks/useSimulations";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { KpiCards } from "@/components/detail/kpi-cards";
import { ForceBreakdown } from "@/components/detail/force-breakdown";
import { SweepInformation } from "@/components/detail/sweep-information";
import { SceneGallery } from "@/components/detail/scene-gallery";
import { SourceFiles } from "@/components/detail/source-files";
import { RawDataPanel } from "@/components/detail/raw-data-panel";
import { RelatedSimulations } from "@/components/detail/related-simulations";
import { LoadingState, ErrorState, EmptyState } from "@/components/status";

export function SimulationView() {
  const jobName = useSearchParams().get("job");
  const { data: rows, isLoading, error } = useSimulations();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;
  if (!rows) return null;
  if (!jobName) return <EmptyState message="No simulation selected." />;

  const row = rows.find((r) => r.job_name === jobName);
  if (!row) {
    return <EmptyState message={`No simulation found with job name "${jobName}".`} />;
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div>
        <Link
          href="/"
          className="text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← Back to Explorer
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{row.job_name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge>{row.component}</Badge>
          <Badge>{row.sweep_type}</Badge>
          <Badge>{row.isolated_vs_fullcar}</Badge>
          {row.owner_initials && <Badge>{row.owner_initials}</Badge>}
          <Badge>{formatDate(row.date)}</Badge>
        </div>
      </div>

      <KpiCards row={row} />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Force Breakdown</h2>
        <ForceBreakdown row={row} />
      </section>

      <RawDataPanel raw={row.raw_force_values} />

      <SweepInformation row={row} />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Scene Gallery</h2>
        <SceneGallery images={row.scene_image_refs} />
      </section>

      <SourceFiles row={row} />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Related Simulations</h2>
        <RelatedSimulations current={row} all={rows} />
      </section>
    </div>
  );
}
