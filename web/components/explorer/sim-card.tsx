"use client";

import Link from "next/link";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { SimRow } from "@/lib/types";
import { driveThumbnailUrl } from "@/lib/drive";
import { formatDate, formatNumber } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export function SimCard({ row }: { row: SimRow }) {
  const heroRef = row.scene_image_refs[0];
  const thumb = heroRef ? driveThumbnailUrl(heroRef) : null;
  const [imgError, setImgError] = useState(false);

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="aspect-video w-full bg-slate-100 dark:bg-slate-800">
        {thumb && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={`${row.job_name} scene preview`}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col gap-2 pt-4">
        <Link
          href={`/simulation?job=${encodeURIComponent(row.job_name)}`}
          className="line-clamp-2 font-medium hover:underline"
        >
          {row.job_name}
        </Link>
        <div className="flex flex-wrap gap-1.5">
          <Badge>{row.component}</Badge>
          <Badge>{row.sweep_type}</Badge>
          {row.owner_initials && <Badge>{row.owner_initials}</Badge>}
        </div>
        <p className="text-xs text-slate-400">{formatDate(row.date)}</p>
        <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
          <Metric label="Total DF" value={formatNumber(row.total_df, { unit: "N" })} />
          <Metric label="Total Drag" value={formatNumber(row.total_drag, { unit: "N" })} />
          <Metric label="CoP" value={formatNumber(row.CoP, { unit: "%" })} />
        </div>
        <div className="mt-auto flex gap-2 pt-3">
          <Link
            href={`/simulation?job=${encodeURIComponent(row.job_name)}`}
            className={buttonVariants({ size: "sm", className: "flex-1" })}
          >
            View Details
          </Link>
          <Link
            href={`/compare?a=${encodeURIComponent(row.job_name)}`}
            className={buttonVariants({ variant: "outline", size: "sm", className: "flex-1" })}
          >
            Compare
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400">{label}</p>
      <p className="font-medium text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}
