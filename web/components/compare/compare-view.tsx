"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSimulations } from "@/hooks/useSimulations";
import { SimPicker } from "@/components/compare/sim-picker";
import { MetadataDiffTable } from "@/components/compare/metadata-diff-table";
import { PerformanceDiffTable } from "@/components/compare/performance-diff-table";
import { SyncedGalleries } from "@/components/compare/synced-galleries";
import { OverlayCompare } from "@/components/compare/overlay-compare";
import { LoadingState, ErrorState, EmptyState } from "@/components/status";
import { Card, CardContent } from "@/components/ui/card";

export function CompareView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: rows, isLoading, error } = useSimulations();

  const aJob = searchParams.get("a");
  const bJob = searchParams.get("b");

  function setJob(slot: "a" | "b", jobName: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(slot, jobName);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;
  if (!rows) return null;

  const a = rows.find((r) => r.job_name === aJob) ?? null;
  const b = rows.find((r) => r.job_name === bJob) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <SimPicker label="Simulation A" rows={rows} value={aJob} onChange={(j) => setJob("a", j)} />
        <p className="hidden pb-2 text-center text-sm font-medium text-slate-400 sm:block">vs</p>
        <SimPicker label="Simulation B" rows={rows} value={bJob} onChange={(j) => setJob("b", j)} />
      </div>

      {!a || !b ? (
        <EmptyState message="Choose two simulations to compare." />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col items-center gap-2 pt-4 text-center sm:flex-row sm:justify-between sm:text-left">
              <p className="text-lg font-semibold">{a.job_name}</p>
              <p className="text-sm text-slate-400">vs</p>
              <p className="text-lg font-semibold">{b.job_name}</p>
            </CardContent>
          </Card>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Metadata Comparison</h2>
            <MetadataDiffTable a={a} b={b} />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Performance Comparison</h2>
            <PerformanceDiffTable a={a} b={b} />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Scene Galleries</h2>
            <SyncedGalleries a={a} b={b} />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Image Overlay</h2>
            <OverlayCompare a={a} b={b} />
          </section>
        </>
      )}
    </div>
  );
}
