"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Data, Layout } from "plotly.js";
import type { SimRow } from "@/lib/types";
import {
  SLICE_IMAGE_PLACEMENT,
  cellYZ,
  commonStations,
  commonVariables,
  dataBox,
  deltaRange,
  fieldDelta,
  sameGrid,
  sharedRange,
  stationIndex,
  type FieldFile,
} from "@/lib/fields";
import { velocitySlices } from "@/lib/slices";
import { driveThumbnailUrl } from "@/lib/drive";
import { CHART_CHROME } from "@/lib/chart-chrome";
import { useColorMode } from "@/hooks/useColorMode";
import { useFieldData } from "@/hooks/useFieldData";
import { useDriveFileNames } from "@/hooks/useDriveFileNames";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/status";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const SOLID = "#9ca3af";
const GEOMETRY_DIFFERS = "#f59e0b";
const THUMB_SIZE = 1600;

/** Field Delta: A (baseline), B and B - A heatmaps of the presentation-grid
 * field data at one x station, optionally laid over each sim's Velocity_X
 * slice image. Only sims with `field_data_refs` take part. */
export function DeltaFieldMap({ rows, baseline }: { rows: SimRow[]; baseline: SimRow }) {
  const others = rows.filter((r) => r.job_name !== baseline.job_name && r.field_data_refs);
  const [bChoice, setBChoice] = useState<string | null>(null);
  const b = others.find((r) => r.job_name === bChoice) ?? others[0] ?? null;

  const [fa, fb] = useFieldData([baseline.field_data_refs, b?.field_data_refs ?? ""]);

  let body;
  if (!baseline.field_data_refs || !b) {
    body = (
      <EmptyState
        message={
          !baseline.field_data_refs
            ? `The baseline (${baseline.job_name}) has no field data. Field data is exported for STRAIGHTLINE sims only.`
            : "No other selected simulation has field data."
        }
      />
    );
  } else if (fa.isLoading || fb.isLoading) {
    body = <LoadingState />;
  } else if (fa.error || fb.error) {
    body = <ErrorState message={((fa.error ?? fb.error) as Error).message} />;
  } else if (fa.data && fb.data) {
    body = <DeltaMaps a={baseline} b={b} fa={fa.data} fb={fb.data} />;
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Field Delta</h2>
        {others.length > 1 && b && (
          <div className="w-72">
            <Select value={b.job_name} onValueChange={setBChoice}>
              <SelectTrigger aria-label="Simulation B">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {others.map((r) => (
                  <SelectItem key={r.job_name} value={r.job_name}>
                    B: {r.job_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {body}
    </section>
  );
}

function DeltaMaps({ a, b, fa, fb }: { a: SimRow; b: SimRow; fa: FieldFile; fb: FieldFile }) {
  const mode = useColorMode();
  const chrome = CHART_CHROME[mode];
  const stations = useMemo(() => commonStations(fa, fb), [fa, fb]);
  const variables = useMemo(() => commonVariables(fa, fb), [fa, fb]);
  const [varKey, setVarKey] = useState<string | null>(null);
  const variable = variables.find((v) => v.key === varKey) ?? variables[0];
  const [index, setIndex] = useState(0);
  const [underlay, setUnderlay] = useState(true);
  const [opacity, setOpacity] = useState(0.6);

  // Slice images by x, from the same Drive-name cache the Slice Roller fills.
  const names = useDriveFileNames([...a.scene_image_refs, ...b.scene_image_refs]);
  const slicesA = velocitySlices(a.scene_image_refs, names).filter((s) => s.axis === "X");
  const slicesB = velocitySlices(b.scene_image_refs, names).filter((s) => s.axis === "X");

  if (!sameGrid(fa, fb)) {
    return <EmptyState message="These two simulations were sampled on different grids, so their fields can't be diffed." />;
  }
  if (!stations.length || !variable) {
    return <EmptyState message="These two simulations share no field station or variable." />;
  }

  const current = Math.min(index, stations.length - 1);
  const x = stations[current];
  const valuesA = fa.data[variable.key][stationIndex(fa, x)];
  const valuesB = fb.data[variable.key][stationIndex(fb, x)];
  const { delta, mask } = fieldDelta(valuesA, valuesB);
  const range = sharedRange(valuesA, valuesB) ?? [0, 1];
  const dMax = deltaRange(delta);
  const unit = variable.unit ? ` ${variable.unit}` : "";
  const sliceAt = (slices: typeof slicesA) => slices.find((s) => Math.abs(s.position - x) < 1e-6)?.url ?? null;
  const sliceA = sliceAt(slicesA);
  const sliceB = sliceAt(slicesB);

  // Cropped to cells with data; plotted with X = -y so the maps read like
  // the slice images (y points left, so the exported y <= 0 half is on the right).
  const nv = fa.counts[1];
  const box = dataBox(fa.counts, [valuesA, valuesB]);
  const rowsU: number[] = [];
  for (let iu = box.u1; iu >= box.u0; iu--) rowsU.push(iu);
  const colsV: number[] = [];
  for (let iv = box.v0; iv <= box.v1; iv++) colsV.push(iv);
  const ys = colsV.map((iv) => cellYZ(fa, 0, iv)[0]);
  const zs = rowsU.map((iu) => cellYZ(fa, iu, 0)[1]);
  const X = ys.map((y) => -y);
  const grid = (get: (i: number) => number | null) =>
    rowsU.map((iu) => colsV.map((iv) => get(iu * nv + iv)));
  const value = (arr: Float32Array) => (i: number) => (Number.isNaN(arr[i]) ? null : arr[i]);
  const fmt = (v: number) => (Number.isNaN(v) ? "solid" : `${v.toPrecision(4)}${unit}`);
  const hover = grid((i) => i).map((row, r) =>
    row.map((i, c) => {
      const d = delta[i!];
      return (
        `y = ${ys[c].toFixed(3)} m<br>z = ${zs[r].toFixed(3)} m<br>` +
        `A = ${fmt(valuesA[i!])}<br>B = ${fmt(valuesB[i!])}<br>` +
        `Δ = ${Number.isNaN(d) ? "–" : `${d >= 0 ? "+" : ""}${d.toPrecision(3)}${unit}`}`
      );
    }),
  );

  const op = underlay ? opacity : 1;
  const maskTrace = (get: (i: number) => number | null): Data => ({
    type: "heatmap",
    x: X,
    y: zs,
    z: grid(get),
    zmin: 0,
    zmax: 1,
    showscale: false,
    opacity: op,
    colorscale: [[0, SOLID], [0.5, SOLID], [0.5, GEOMETRY_DIFFERS], [1, GEOMETRY_DIFFERS]],
    hoverinfo: "skip",
  });
  const valueTrace = (arr: Float32Array, extra: Partial<Data>): Data =>
    ({
      type: "heatmap",
      x: X,
      y: zs,
      z: grid(value(arr)),
      text: hover,
      hoverinfo: "text",
      opacity: op,
      colorbar: { thickness: 10, len: 0.9, title: { text: variable.unit, side: "right" } },
      ...extra,
    }) as Data;
  const solidOnly = (arr: Float32Array) => (i: number) => (Number.isNaN(arr[i]) ? 0 : null);
  const maskCategory = (i: number) => (mask[i] === "both" ? 0 : mask[i] === "one" ? 1 : null);

  const halfX = Math.abs(X[1] - X[0]) / 2 || 0;
  const halfZ = Math.abs(zs[0] - zs[1]) / 2 || 0;
  const xRange = [Math.min(...X) - halfX, Math.max(...X) + halfX];
  const ticks: number[] = [];
  for (let t = Math.ceil(xRange[0] * 10) / 10; t <= xRange[1] + 1e-9; t += 0.1) ticks.push(Number(t.toFixed(2)));
  const layout = (sliceUrl: string | null): Partial<Layout> => {
    const thumb = underlay && sliceUrl ? driveThumbnailUrl(sliceUrl, THUMB_SIZE) : null;
    const p = SLICE_IMAGE_PLACEMENT;
    return {
      autosize: true,
      margin: { l: 50, r: 10, t: 6, b: 45 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: chrome.text, size: 11 },
      xaxis: {
        title: { text: "y (m)" },
        range: xRange,
        tickvals: ticks,
        ticktext: ticks.map((t) => (-t).toFixed(1)),
        gridcolor: chrome.grid,
        showgrid: !thumb,
        zeroline: false,
        constrain: "domain",
      },
      yaxis: {
        title: { text: "z (m)" },
        range: [Math.min(...zs) - halfZ, Math.max(...zs) + halfZ],
        gridcolor: chrome.grid,
        showgrid: !thumb,
        zeroline: false,
        scaleanchor: "x",
        scaleratio: 1,
      },
      images: thumb
        ? [
            {
              source: thumb,
              xref: "x",
              yref: "y",
              x: -p.yZeroAt * p.width,
              y: p.zZeroAt * p.height,
              sizex: p.width,
              sizey: p.height,
              xanchor: "left",
              yanchor: "top",
              sizing: "stretch",
              layer: "below",
            },
          ]
        : [],
    };
  };

  const panels: { title: string; data: Data[]; slice: string | null }[] = [
    {
      title: `A · ${a.job_name}`,
      data: [maskTrace(solidOnly(valuesA)), valueTrace(valuesA, { colorscale: "Viridis", zmin: range[0], zmax: range[1] })],
      slice: sliceA,
    },
    {
      title: `B · ${b.job_name}`,
      data: [maskTrace(solidOnly(valuesB)), valueTrace(valuesB, { colorscale: "Viridis", zmin: range[0], zmax: range[1] })],
      slice: sliceB,
    },
    {
      title: "B − A",
      data: [
        maskTrace(maskCategory),
        valueTrace(delta, { colorscale: "RdBu", reversescale: true, zmid: 0, zmin: -dMax, zmax: dMax } as Partial<Data>),
      ],
      slice: sliceA,
    },
  ];

  const compared = mask.filter((m) => m === null).length;
  const differs = mask.filter((m) => m === "one").length;
  const step = (d: number) => setIndex(Math.min(stations.length - 1, Math.max(0, current + d)));

  return (
    <div
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") step(-1);
        else if (e.key === "ArrowRight") step(1);
        else return;
        e.preventDefault();
      }}
      className="rounded-lg focus:outline-none"
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={current === 0}
          aria-label="Previous station"
          className="rounded-md border border-slate-300 p-1 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Slider
          value={[current]}
          onValueChange={([v]) => setIndex(v)}
          min={0}
          max={Math.max(0, stations.length - 1)}
          step={1}
          disabled={stations.length < 2}
          aria-label="Field station"
          className="min-w-48 flex-1"
        />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={current === stations.length - 1}
          aria-label="Next station"
          className="rounded-md border border-slate-300 p-1 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="w-36 shrink-0 text-right text-sm font-medium tabular-nums">
          X = {x.toFixed(2)}
          <span className="ml-1 text-xs font-normal text-slate-400">
            ({current + 1}/{stations.length})
          </span>
        </span>
        <div className="w-56">
          <Select value={variable.key} onValueChange={setVarKey}>
            <SelectTrigger aria-label="Field variable">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {variables.map((v) => (
                <SelectItem key={v.key} value={v.key}>
                  {v.unit ? `${v.name} (${v.unit})` : v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            className="accent-blue-600"
            checked={underlay}
            onChange={(e) => setUnderlay(e.target.checked)}
          />
          Slice image underneath
        </label>
        {underlay && (
          <label className="flex items-center gap-2">
            Map opacity
            <Slider
              value={[opacity]}
              onValueChange={([v]) => setOpacity(v)}
              min={0}
              max={1}
              step={0.05}
              aria-label="Map opacity"
              className="w-32"
            />
          </label>
        )}
        {underlay && !sliceA && !sliceB && <span>No Velocity_X slice image at this station.</span>}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {panels.map((p) => (
          <div key={p.title} className="min-w-0 rounded-lg border border-slate-200 p-2 dark:border-slate-800">
            <p className="mb-1 truncate text-xs font-medium" title={p.title}>
              {p.title}
            </p>
            <Plot
              data={p.data}
              layout={layout(p.slice)}
              config={{ displaylogo: false, responsive: true }}
              useResizeHandler
              style={{ width: "100%", height: 460 }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded-sm align-[-2px]" style={{ background: SOLID }} />
          solid (no data)
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded-sm align-[-2px]" style={{ background: GEOMETRY_DIFFERS }} />
          geometry differs (data in only one sim)
        </span>
        <span>
          {compared} cells compared, {differs} geometry-differs. Δ colours span ±{dMax.toPrecision(3)}
          {unit}. Viewed like the slice images: y points left.
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Click the maps, then use ← / → to step through stations. The slice image placement is approximate.
      </p>
    </div>
  );
}
