"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnPinningState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Pin, PinOff } from "lucide-react";
import type { SimRow } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const columnHelper = createColumnHelper<SimRow>();

const columns = [
  columnHelper.accessor("job_name", {
    header: "Job Name",
    cell: (info) => (
      <Link
        href={`/simulation?job=${encodeURIComponent(info.getValue())}`}
        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor("component", { header: "Component" }),
  columnHelper.accessor("sweep_type", { header: "Sweep Type" }),
  columnHelper.accessor("owner_initials", { header: "Owner" }),
  columnHelper.accessor("date", {
    header: "Date",
    cell: (info) => formatDate(info.getValue()),
  }),
  columnHelper.accessor("total_df", {
    header: "Total DF",
    cell: (info) => formatNumber(info.getValue(), { unit: "N" }),
  }),
  columnHelper.accessor("total_drag", {
    header: "Total Drag",
    cell: (info) => formatNumber(info.getValue(), { unit: "N" }),
  }),
  columnHelper.accessor("CoP", {
    header: "CoP",
    cell: (info) => formatNumber(info.getValue(), { unit: "%" }),
  }),
  columnHelper.accessor("cell_count", {
    header: "Cell Count",
    cell: (info) => formatNumber(info.getValue(), { digits: 0 }),
  }),
];

export function SimTable({ rows }: { rows: SimRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: ["job_name"] });

  const data = useMemo(() => rows, [rows]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnPinning },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    enableMultiSort: true,
    enableColumnPinning: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <ColumnVisibilityMenu table={table} />
      </div>
      <div className="rounded-lg border border-slate-200 dark:border-slate-800">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const pinned = header.column.getIsPinned();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "group",
                        pinned && "sticky left-0 z-10 bg-white dark:bg-slate-900",
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                          onClick={header.column.getToggleSortingHandler()}
                          title="Click to sort, shift-click to multi-sort"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDir === "asc" && <ArrowUp className="h-3 w-3" />}
                          {sortDir === "desc" && <ArrowDown className="h-3 w-3" />}
                          {!sortDir && (
                            <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => header.column.pin(pinned ? false : "left")}
                          className="opacity-0 group-hover:opacity-60 hover:!opacity-100"
                          title={pinned ? "Unpin column" : "Pin column"}
                        >
                          {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </button>
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const pinned = cell.column.getIsPinned();
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(pinned && "sticky left-0 z-10 bg-white dark:bg-slate-900")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-slate-400">
                  No simulations match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ColumnVisibilityMenu({ table }: { table: ReturnType<typeof useReactTable<SimRow>> }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="h-4 w-4" /> Columns
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={4}
          className="z-50 w-48 rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {table.getAllLeafColumns().map((column) => (
            <label
              key={column.id}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Checkbox
                checked={column.getIsVisible()}
                onCheckedChange={(v) => column.toggleVisibility(!!v)}
              />
              {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
            </label>
          ))}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
