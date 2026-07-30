"use client";

import Papa from "papaparse";
import { Download } from "lucide-react";
import type { SimRow } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function ExportButton({ rows }: { rows: SimRow[] }) {
  function handleExport() {
    const plain = rows.map((row) => ({
      ...row,
      dateObj: undefined,
      scene_image_refs: row.scene_image_refs.join(";"),
    }));
    const csv = Papa.unparse(plain);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulations_filtered_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
      <Download className="h-4 w-4" /> Export ({rows.length})
    </Button>
  );
}
