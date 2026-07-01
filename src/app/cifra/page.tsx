import { Suspense } from "react";
import CifraClient from "@/components/CifraClient";

export const dynamic = "force-dynamic";

export default function CifraPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted">
          Carregando…
        </div>
      }
    >
      <CifraClient />
    </Suspense>
  );
}
