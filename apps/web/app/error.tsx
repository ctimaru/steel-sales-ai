"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RootRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("root_route_error", {
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f4f3] px-4 py-10">
      <section className="w-full max-w-xl rounded-3xl border border-[#dce2df] bg-white p-7 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a6520]">
          Recovery
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#1d2824]">
          Non è stato possibile completare il caricamento
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#66736e]">
          Il dettaglio tecnico è stato nascosto. Riprova oppure torna a un punto
          sicuro dell’applicazione.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="h-10 rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white"
          >
            Riprova
          </button>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d7dfdb] bg-white px-4 text-sm font-semibold text-[#43524c]"
          >
            Torna al sito
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
