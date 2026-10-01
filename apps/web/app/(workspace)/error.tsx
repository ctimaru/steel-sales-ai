"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("workspace_route_error", {
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl py-8">
      <section className="rounded-3xl border border-[#ead7aa] bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a6520]">
          Recovery
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#1d2824]">
          Questa sezione non è disponibile in questo momento
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66736e]">
          Nessun dato è stato considerato salvato da questa schermata. Puoi
          riprovare senza ricaricare l’intera applicazione oppure tornare al
          workspace.
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
            href="/dashboard"
            className="app-secondary inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold"
          >
            Torna al workspace
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-5 text-xs text-[#8b9792]">
            Riferimento tecnico: {error.digest}
          </p>
        ) : null}
      </section>
    </div>
  );
}
