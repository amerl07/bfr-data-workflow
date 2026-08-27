"use client";

import { ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DateSortToggle({
  newestFirst,
  onChange,
}: {
  newestFirst: boolean;
  onChange: (newestFirst: boolean) => void;
}) {
  return (
    <Button variant="outline" size="sm" onClick={() => onChange(!newestFirst)}>
      {newestFirst ? (
        <ArrowDownWideNarrow className="h-4 w-4" />
      ) : (
        <ArrowUpWideNarrow className="h-4 w-4" />
      )}
      {newestFirst ? "Newest first" : "Oldest first"}
    </Button>
  );
}
