import type { SimRow } from "@/lib/types";
import { formatDate } from "@/lib/format";
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

export function MetadataDiffTable({ a, b }: { a: SimRow; b: SimRow }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Property</TableHead>
          <TableHead>A</TableHead>
          <TableHead>B</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {FIELDS.map((f) => (
          <TableRow key={f.label}>
            <TableCell className="text-slate-500 dark:text-slate-400">{f.label}</TableCell>
            <TableCell>{f.get(a)}</TableCell>
            <TableCell>{f.get(b)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
