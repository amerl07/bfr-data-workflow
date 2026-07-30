import { FileArchive, FolderOpen } from "lucide-react";
import type { SimRow } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SourceFiles({ row }: { row: SimRow }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Source Files</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          <FileArchive className="h-4 w-4 shrink-0 text-slate-400" />
          <span>{row.post_zip_name || "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 shrink-0 text-slate-400" />
          {row.source_drive_folder ? (
            <a
              href={row.source_drive_folder}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Google Drive Folder
            </a>
          ) : (
            <span className="text-slate-400">No batch folder (dropped loose)</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
