import type { SimRow } from "@/lib/types";
import { METRICS } from "@/lib/metrics";
import { formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function ForceBreakdown({ row }: { row: SimRow }) {
  const downforce = METRICS.filter((m) => m.group === "downforce");
  const drag = METRICS.filter((m) => m.group === "drag");
  const areaCoefficient = METRICS.filter((m) => m.group === "area-coefficient");
  const cop = METRICS.filter((m) => m.group === "cop");
  const radiator = METRICS.filter((m) => m.group === "radiator");
  const mesh = METRICS.filter((m) => m.group === "mesh");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>Downforce</CardTitle>
        </CardHeader>
        <CardContent>
          {downforce.map((m) => (
            <Row key={m.key} label={m.label} value={formatNumber(row[m.key], { unit: m.unit })} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Drag</CardTitle>
        </CardHeader>
        <CardContent>
          {drag.map((m) => (
            <Row key={m.key} label={m.label} value={formatNumber(row[m.key], { unit: m.unit })} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Area and Coefficients</CardTitle>
        </CardHeader>
        <CardContent>
          {areaCoefficient.map((m) => (
            <Row key={m.key} label={m.label} value={formatNumber(row[m.key], { unit: m.unit })} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Center of Pressure</CardTitle>
        </CardHeader>
        <CardContent>
          {cop.map((m) => (
            <Row key={m.key} label={m.label} value={formatNumber(row[m.key], { unit: m.unit })} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Radiator</CardTitle>
        </CardHeader>
        <CardContent>
          {radiator.map((m) => (
            <Row key={m.key} label={m.label} value={formatNumber(row[m.key], { unit: m.unit })} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sim Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          {mesh.map((m) => (
            <Row key={m.key} label={m.label} value={formatNumber(row[m.key], { unit: m.unit })} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
