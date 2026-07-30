"use client";

import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDown, Search } from "lucide-react";
import type { SimRow } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SimPicker({
  label,
  rows,
  value,
  onChange,
}: {
  label: string;
  rows: SimRow[];
  value: string | null;
  onChange: (jobName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = rows.find((r) => r.job_name === value) ?? null;
  const filtered = rows
    .filter((r) => r.job_name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 50);

  return (
    <div>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-left text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <span className={cn("truncate", !selected && "text-slate-400")}>
              {selected ? selected.job_name : "Choose a simulation…"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            className="z-50 w-[--radix-popover-trigger-width] max-w-md rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 px-2 dark:border-slate-800">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search job name…"
                className="h-9 w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="max-h-72 overflow-auto p-1">
              {filtered.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-slate-400">No matches</p>
              )}
              {filtered.map((row) => (
                <button
                  key={row.job_name}
                  type="button"
                  onClick={() => {
                    onChange(row.job_name);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full flex-col rounded-sm px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="truncate text-sm">{row.job_name}</span>
                  <span className="text-xs text-slate-400">
                    {row.component} · {row.sweep_type} · {formatDate(row.date)}
                  </span>
                </button>
              ))}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
