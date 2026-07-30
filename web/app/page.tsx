import { Suspense } from "react";
import { ExplorerView } from "@/components/explorer/explorer-view";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <ExplorerView />
    </Suspense>
  );
}
