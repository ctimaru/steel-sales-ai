"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("platform_route_error", {
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="rounded-3xl border border-[#ead7aa] bg-white p-7 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a6520]">
          Platform recovery
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#1d2824]">
          Operazione Platform non caricata
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#66736e]">
          Riprova il caricamento. Se lo stato è cambiato nel frattempo, la
          schermata aggiornata mostrerà il valore autoritativo del database.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="app-primary inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold"
          >
            Riprova
          </button>
          <Link
            href="/platform"
            className="app-secondary inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold"
          >
            Torna al Control Plane
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-5 text-xs text-[#8b9792]">
            Riferimento tecnico: {error.digest}
          </p>
        ) : null}
      </section>
    </main>
  );
}
