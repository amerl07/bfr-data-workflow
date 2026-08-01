import type { SimRow } from "@/lib/types";
import { METRICS } from "@/lib/metrics";
import { formatNumber } from "@/lib/format";
import { parseRawForceValues } from "@/lib/rawForceValues";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// No dedicated SimRow column for these -- per the "don't invent columns for
// undefined labels" decision (ingestion/queue_consumer/main.py's
// FORCE_LABEL_COLUMNS comment), they only ever live in raw_force_values.
// Confirmed present in the second force_reports.txt sample (2026-08-01,
// docs/"force_reports copy.txt") -- cooling/pressure figures, not forces.
const COOLING_METRICS: { match: string; label: string }[] = [
  { match: "radiator mfr", label: "Radiator MFR" },
  { match: "inlet mfa", label: "Inlet MFA" },
  { match: "outlet mfa", label: "Outlet MFA" },
  { match: "pressure drop", label: "Pressure Drop" },
];

export function ForceBreakdown({ row }: { row: SimRow }) {
  const aeroForces = METRICS.filter((m) => m.group === "aero-force");
  const dragForces = METRICS.filter((m) => m.group === "drag");
  const rawEntries = parseRawForceValues(row.raw_force_values);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      <Card>
        <CardHeader>
          <CardTitle>Cooling &amp; Pressure</CardTitle>
        </CardHeader>
        <CardContent>
          {COOLING_METRICS.map((m) => {
            const entry = rawEntries.get(m.match);
            return (
              <Row
                key={m.match}
                label={m.label}
                value={formatNumber(entry?.value ?? null, { unit: entry?.unit })}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
