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
  const aeroForces = METRICS.filter((m) => m.group === "aero-force");
  const dragForces = METRICS.filter((m) => m.group === "drag");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Aerodynamic Forces</CardTitle>
        </CardHeader>
        <CardContent>
          {aeroForces.map((m) => (
            <Row key={m.key} label={m.label} value={formatNumber(row[m.key], { unit: m.unit })} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Drag</CardTitle>
        </CardHeader>
        <CardContent>
          {dragForces.map((m) => (
            <Row key={m.key} label={m.label} value={formatNumber(row[m.key], { unit: m.unit })} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Center of Pressure</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="CoP (%)" value={formatNumber(row.CoP, { unit: "%" })} />
          <Row label="CoP (m)" value={formatNumber(row.CoP_meters, { unit: "m" })} />
        </CardContent>
      </Card>
    </div>
  );
}
