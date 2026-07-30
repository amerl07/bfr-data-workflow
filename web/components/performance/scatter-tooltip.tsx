"use client";

import { useState } from "react";
import type { SimRow } from "@/lib/types";
import { driveThumbnailUrl } from "@/lib/drive";
import { formatDate, formatNumber } from "@/lib/format";

export function ScatterTooltip({ row, x, y }: { row: SimRow; x: number; y: number }) {
  const [imgError, setImgError] = useState(false);
  const thumb = row.scene_image_refs[0] ? driveThumbnailUrl(row.scene_image_refs[0]) : null;

  return (
    <div
      className="pointer-events-none fixed z-50 flex w-56 gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
      style={{ left: x + 14, top: y + 14 }}
    >
      {thumb && !imgError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          onError={() => setImgError(true)}
          className="h-14 w-14 shrink-0 rounded object-cover"
        />
      )}
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900 dark:text-slate-100">{row.job_name}</p>
        <p className="text-slate-500 dark:text-slate-400">
          {row.component} · {row.sweep_type} · {row.owner_initials}
        </p>
        <p className="text-slate-400">{formatDate(row.date)}</p>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          DF {formatNumber(row.total_df, { unit: "N" })} · Drag{" "}
          {formatNumber(row.total_drag, { unit: "N" })} · CoP {formatNumber(row.CoP, { unit: "%" })}
        </p>
      </div>
    </div>
  );
}
