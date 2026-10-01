"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global_route_error", {
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  return (
    <html lang="it">
      <body className="bg-[#f2f4f3]">
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <section className="w-full max-w-xl rounded-3xl border border-[#dce2df] bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a6520]">
              Smart Steel Sales
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#1d2824]">
              Si è verificato un errore temporaneo
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              Il messaggio tecnico non viene esposto. Puoi riprovare oppure
              rientrare dall’accesso senza perdere dati già confermati.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reset}
                className="h-10 rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white"
              >
                Riprova
              </button>
              <a
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d7dfdb] bg-white px-4 text-sm font-semibold text-[#43524c]"
              >
                Vai all’accesso
              </a>
            </div>
            {error.digest ? (
              <p className="mt-5 text-xs text-[#8b9792]">
                Riferimento tecnico: {error.digest}
              </p>
            ) : null}
          </section>
        </main>
      </body>
    </html>
  );
}
