import type { SimRow } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SimColumnHeads, STICKY_LABEL_COL } from "@/components/compare/compare-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const FIELDS: { label: string; get: (r: SimRow) => string }[] = [
  { label: "Component", get: (r) => r.component || "—" },
  { label: "Sweep Type", get: (r) => r.sweep_type || "—" },
  { label: "Owner", get: (r) => r.owner_initials || "—" },
  { label: "Date", get: (r) => formatDate(r.date) },
  { label: "Isolated / Full Car", get: (r) => r.isolated_vs_fullcar || "—" },
  { label: "Swept Variable", get: (r) => r.swept_variable || "—" },
  { label: "Sweep Range", get: (r) => r.swept_range || "—" },
];

export function MetadataDiffTable({ rows, baseline }: { rows: SimRow[]; baseline: SimRow }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={STICKY_LABEL_COL}>Property</TableHead>
          <SimColumnHeads rows={rows} baseline={baseline} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {FIELDS.map((f) => (
          <TableRow key={f.label}>
            <TableCell className={cn(STICKY_LABEL_COL, "text-slate-500 dark:text-slate-400")}>{f.label}</TableCell>
            {rows.map((r) => (
              <TableCell key={r.job_name}>{f.get(r)}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
