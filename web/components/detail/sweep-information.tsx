import type { SimRow } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SweepInformation({ row }: { row: SimRow }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sweep Information</CardTitle>
      </CardHeader>
      <CardContent>
        {row.swept_variable ? (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Swept Variable</span>
              <span className="font-medium">{row.swept_variable}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Sweep Range</span>
              <span className="font-medium">{row.swept_range || "—"}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            No parameter sweep associated with this simulation.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
