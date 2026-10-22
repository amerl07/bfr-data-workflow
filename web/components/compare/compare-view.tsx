"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import type { SimRow } from "@/lib/types";
import { buildCompareParams, parseCompareParams, type CompareSelection } from "@/lib/compare";
import { useSimulations } from "@/hooks/useSimulations";
import { SimPicker } from "@/components/compare/sim-picker";
import { MetadataDiffTable } from "@/components/compare/metadata-diff-table";
import { PerformanceDiffTable } from "@/components/compare/performance-diff-table";
import { CompareGalleries } from "@/components/compare/compare-galleries";
import { SliceRoller } from "@/components/shared/slice-roller";
import { LoadingState, ErrorState, EmptyState } from "@/components/status";
import { cn } from "@/lib/utils";

export function CompareView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: rows, isLoading, error } = useSimulations();

  const { sims, base } = parseCompareParams(searchParams);

  function update(next: CompareSelection) {
    const params = buildCompareParams(searchParams, next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function replaceSim(index: number, jobName: string) {
    const next = sims.slice();
    next[index] = jobName;
    const deduped = [...new Set(next)];
    // Keep the baseline pointing at the same slot if that slot was swapped out.
    const nextBase = base === sims[index] ? jobName : base;
    update({ sims: deduped, base: nextBase && deduped.includes(nextBase) ? nextBase : deduped[0] ?? null });
  }

  function addSim(jobName: string) {
    if (sims.includes(jobName)) return;
    update({ sims: [...sims, jobName], base: base ?? jobName });
  }

  function removeSim(jobName: string) {
    const next = sims.filter((s) => s !== jobName);
    update({ sims: next, base: base === jobName ? next[0] ?? null : base });
  }

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;
  if (!rows) return null;

  // Drop job names that no longer exist in the dataset rather than erroring.
  const selected = sims
    .map((job) => rows.find((r) => r.job_name === job))
    .filter((r): r is SimRow => !!r);
  const baseline = selected.find((r) => r.job_name === base) ?? selected[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sims.map((job, i) => (
          <div key={job} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <SimPicker
                label={`Simulation ${String.fromCharCode(65 + i)}`}
                rows={rows}
                value={job}
                onChange={(j) => replaceSim(i, j)}
              />
            </div>
            <label
              className={cn(
                "flex h-10 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs font-medium",
                job === baseline?.job_name
                  ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800",
              )}
              title="Use as the baseline that every other simulation's deltas are computed against"
            >
              <input
                type="radio"
                name="compare-baseline"
                className="accent-blue-600"
                checked={job === baseline?.job_name}
                onChange={() => update({ sims, base: job })}
              />
              Baseline
            </label>
            <button
              type="button"
              aria-label={`Remove ${job}`}
              onClick={() => removeSim(job)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <SimPicker
          key={`add-${sims.length}`}
          label={sims.length < 2 ? `Simulation ${String.fromCharCode(65 + sims.length)}` : "Add simulation"}
          rows={rows.filter((r) => !sims.includes(r.job_name))}
          value={null}
          onChange={addSim}
        />
      </div>

      {selected.length < 2 || !baseline ? (
        <EmptyState message="Choose at least two simulations to compare." />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-lg font-semibold">Metadata Comparison</h2>
            <MetadataDiffTable rows={selected} baseline={baseline} />
          </section>

          <section>
            <h2 className="mb-1 text-lg font-semibold">Performance Comparison</h2>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Deltas are relative to the baseline ({baseline.job_name}). 
            </p>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Green = better, red = worse; metrics with no better direction (CoP, areas, radiator, …) are green when higher, red when lower. 
              Force deltas (raw and %) are only colored beyond ±1.5 N.
            </p>
            <PerformanceDiffTable rows={selected} baseline={baseline} />
          </section>

          <SliceRoller
            title="Slice Roller"
            sims={selected.map((r, i) => ({
              key: r.job_name,
              tag: String.fromCharCode(65 + i),
              urls: r.scene_image_refs,
            }))}
            // Baseline on the bottom layer, matching the gallery overlay below.
            overlayOrder={[
              baseline.job_name,
              ...selected.filter((r) => r.job_name !== baseline.job_name).map((r) => r.job_name),
            ]}
          />

          <section>
            <h2 className="mb-3 text-lg font-semibold">Scene Galleries</h2>
            <CompareGalleries rows={selected} baseline={baseline} />
          </section>
        </>
      )}
    </div>
  );
}
