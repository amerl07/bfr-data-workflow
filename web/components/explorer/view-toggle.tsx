"use client";

import { LayoutGrid, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExplorerView = "card" | "table";

export function ViewToggle({
  view,
  onChange,
}: {
  view: ExplorerView;
  onChange: (view: ExplorerView) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-slate-300 p-0.5 dark:border-slate-700">
      {(
        [
          { key: "card", icon: LayoutGrid, label: "Card view" },
          { key: "table", icon: Table2, label: "Table view" },
        ] as const
      ).map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          onClick={() => onChange(key)}
          className={cn(
            "flex items-center gap-1.5 rounded px-2.5 py-1 text-sm",
            view === key
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
