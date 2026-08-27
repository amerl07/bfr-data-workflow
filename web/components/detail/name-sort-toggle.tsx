"use client";

import { ArrowDownAZ, ArrowDownZA } from "lucide-react";
import { Button } from "@/components/ui/button";

export type NameSortDirection = "asc" | "desc";

export function NameSortToggle({
  direction,
  onChange,
}: {
  direction: NameSortDirection;
  onChange: (direction: NameSortDirection) => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onChange(direction === "asc" ? "desc" : "asc")}
    >
      {direction === "asc" ? (
        <ArrowDownAZ className="h-4 w-4" />
      ) : (
        <ArrowDownZA className="h-4 w-4" />
      )}
      {direction === "asc" ? "A to Z" : "Z to A"}
    </Button>
  );
}
