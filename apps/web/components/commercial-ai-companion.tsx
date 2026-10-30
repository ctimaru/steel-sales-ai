"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { appRoutes } from "@/lib/routes";
import cinematic from "@/components/commercial-cinematic.module.css";

/** COMM-CINE10: grounded entry points, not a simulated chatbot. */
export function CommercialAiCompanion({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const [request, setRequest] = useState("");
  const [error, setError] = useState("");
  function startRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = request.trim();
    if (!canWrite || !value) return;
    try {
      sessionStorage.setItem("sss:commercial-ai-intake-handoff", value);
      setError("");
      router.push(appRoutes.commercial.home + "?compose=1#commercial-ai-intake");
    } catch {
      setError("Non è stato possibile trasferire il testo. Apri la distinta e inseriscilo direttamente.");
    }
  }
  return (
    <section aria-labelledby="commercial-ai-first-heading" data-testid="commercial-ai-first"
      className={"relative overflow-hidden rounded-[20px] border border-[#d7e8dd] bg-white p-3 sm:px-5 sm:py-4 " + cinematic.companion}>
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#174f3a] text-lg text-white">✦</div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#3e7957]">Il tuo assistente commerciale</p>
            <h2 id="commercial-ai-first-heading"
              className={"mt-1 text-[clamp(1.3rem,1.85vw,1.75rem)] font-semibold leading-[1.16] tracking-[-0.035em] text-[#143f30] " + cinematic.companionTitle}>
              Ciao, cosa stai cercando oggi?
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#5c7063]">
              Descrivi il materiale. Scegli tu cosa preparare: nessuna richiesta viene inviata automaticamente.
            </p>
          </div>
        </div>
        {canWrite ? (
          <form onSubmit={startRequest} data-testid="comm-cine11-prompt" className={"min-w-0 space-y-1.5 " + cinematic.companionForm}>
            <label htmlFor="commercial-ai-companion-input" className="sr-only">Descrivi il materiale</label>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
              <textarea id="commercial-ai-companion-input" value={request} maxLength={12000} rows={2}
                onChange={(event) => setRequest(event.target.value)}
                placeholder="Es. 40 tubi quadri 100×100×5, S355, 6 m"
                className="min-h-[64px] min-w-0 flex-1 resize-y rounded-xl border border-[#b8d6c3] bg-white px-3 py-2 text-sm leading-5 text-[#143f30] placeholder:text-[#72877a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]" />
              <button type="submit" disabled={!request.trim()} data-testid="commercial-ai-first-cta"
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-[#175640] px-4 text-xs font-semibold text-white hover:bg-[#104632] disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-[164px]">
                Prepara la distinta →
              </button>
            </div>
            {error ? <p role="alert" className="text-xs text-[#9d4e28]">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="text-[11px] leading-4 text-[#5c7063]">Bozza privata, da confermare prima dell’analisi.</p>
              <Link href={appRoutes.commercial.home + "?compose=1#commercial-compose"}
                className="inline-flex min-h-8 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">
                Compila manualmente →
              </Link>
            </div>
          </form>
        ) : (
          <p className="text-xs leading-5 text-[#5c7063]">
            Consultazione in sola lettura. Puoi consultare le trattative, senza preparare o inviare richieste.
          </p>
        )}
      </div>
    </section>
  );
}
