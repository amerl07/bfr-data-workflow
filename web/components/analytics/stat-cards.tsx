import type { SimRow } from "@/lib/types";
import { distinctValues } from "@/lib/filters";
import { mean } from "@/lib/stats";
import { formatDate, formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function numeric(rows: SimRow[], key: "total_df" | "total_drag" | "cell_count"): number[] {
  return rows.map((r) => r[key]).filter((v): v is number => v !== null);
}

export function StatCards({ rows }: { rows: SimRow[] }) {
  const components = distinctValues(rows, "component");
  const owners = distinctValues(rows, "owner_initials");
  const latest = rows
    .map((r) => r.date)
    .filter(Boolean)
    .sort()
    .at(-1);

  const items = [
    { label: "Total Simulations", value: rows.length.toLocaleString() },
    { label: "Components", value: components.length.toLocaleString() },
    { label: "Owners", value: owners.length.toLocaleString() },
    { label: "Avg Total DF", value: formatNumber(mean(numeric(rows, "total_df")), { unit: "N" }) },
    { label: "Avg Drag", value: formatNumber(mean(numeric(rows, "total_drag")), { unit: "N" }) },
    {
      label: "Avg Cell Count",
      value: formatNumber(mean(numeric(rows, "cell_count")), { digits: 0 }),
    },
    { label: "Latest Simulation", value: latest ? formatDate(latest) : "—" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-0">
            <CardTitle>{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold tracking-tight">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
