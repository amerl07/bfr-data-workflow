import type { SimRow } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KpiCards({ row }: { row: SimRow }) {
  const items = [
    { label: "Total Downforce", value: formatNumber(row.total_df, { unit: "N" }) },
    { label: "Total Drag", value: formatNumber(row.total_drag, { unit: "N" }) },
    { label: "CoP", value: formatNumber(row.CoP, { unit: "%" }) },
    { label: "Cell Count", value: formatNumber(row.cell_count, { digits: 0 }) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-0">
            <CardTitle>{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
