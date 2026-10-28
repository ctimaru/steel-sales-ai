"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { appRoutes } from "@/lib/routes";

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
      className="relative isolate overflow-hidden rounded-[26px] border border-[#d7e8dd] bg-white p-5 shadow-[0_20px_60px_-44px_rgba(8,55,39,0.45)] sm:p-7">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-[#e6f3e9] blur-3xl" />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#174f3a] text-2xl text-white shadow-[0_14px_30px_-16px_rgba(5,47,34,0.8)]">✦</div>
          <div className="max-w-[630px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#3e7957]">Il tuo assistente commerciale</p>
            <h2 id="commercial-ai-first-heading" className="mt-2 text-[clamp(1.5rem,2.6vw,2.5rem)] font-semibold leading-tight tracking-[-0.035em] text-[#143f30]">
              Ciao, cosa stai cercando oggi?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5c7063]">
              Parti dal materiale, dalla calcolatrice o dalle tue trattative. Scegli tu cosa aprire: nessuna richiesta viene inviata automaticamente.
            </p>
          </div>
        </div>
        {canWrite ? (
          <form onSubmit={startRequest} data-testid="comm-cine11-prompt" className="w-full max-w-[390px] space-y-2">
            <label htmlFor="commercial-ai-companion-input" className="text-xs font-semibold text-[#34674c]">Descrivi il materiale</label>
            <textarea id="commercial-ai-companion-input" value={request} maxLength={12000} rows={3}
              onChange={(event) => setRequest(event.target.value)}
              placeholder="Es. 40 tubi quadri 100×100×5, S355, 6 m"
              className="w-full resize-y rounded-xl border border-[#b8d6c3] bg-white px-3 py-3 text-sm text-[#143f30] placeholder:text-[#72877a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]" />
            {error ? <p role="alert" className="text-xs text-[#9d4e28]">{error}</p> : null}
            <button type="submit" disabled={!request.trim()} data-testid="commercial-ai-first-cta"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#175640] px-5 text-sm font-semibold text-white hover:bg-[#104632] disabled:cursor-not-allowed disabled:opacity-50">
              Prepara la distinta →
            </button>
            <p className="text-[11px] leading-4 text-[#5c7063]">Il testo passa alla bozza privata. L’analisi parte solo dopo la tua conferma.</p>
            <Link href={appRoutes.commercial.home + "?compose=1#commercial-compose"}
              className="inline-flex min-h-9 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">
              Preferisci compilare manualmente?
            </Link>
          </form>
        ) : null}
      </div>
      <div className="mt-6 grid gap-2 border-t border-[#e0ebe3] pt-5 sm:grid-cols-3">
        <button type="button" onClick={() => window.dispatchEvent(new Event("sss:open-commercial-calculator"))}
          className="flex min-h-12 items-center justify-between rounded-xl border border-[#d9e8de] bg-[#f7fbf8] px-4 text-left text-sm font-semibold text-[#175640] transition hover:bg-[#e9f4ec] focus-visible:outline-2 focus-visible:outline-offset-2">
          Calcola il peso <span aria-hidden="true">↗</span>
        </button>
        <Link href={appRoutes.commercial.home + "#commercial-worklist"}
          className="flex min-h-12 items-center justify-between rounded-xl border border-[#d9e8de] bg-[#f7fbf8] px-4 text-sm font-semibold text-[#175640] transition hover:bg-[#e9f4ec] focus-visible:outline-2 focus-visible:outline-offset-2">
          Le mie trattative <span aria-hidden="true">→</span>
        </Link>
        <Link href={appRoutes.commercial.assistant}
          className="flex min-h-12 items-center justify-between rounded-xl border border-[#d9e8de] bg-[#f7fbf8] px-4 text-sm font-semibold text-[#175640] transition hover:bg-[#e9f4ec] focus-visible:outline-2 focus-visible:outline-offset-2">
          Interroga la memoria privata <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
