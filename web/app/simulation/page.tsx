import { Suspense } from "react";
import { SimulationView } from "@/components/detail/simulation-view";

export default function SimulationPage() {
  return (
    <Suspense fallback={null}>
      <SimulationView />
    </Suspense>
  );
}
