"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";

import { appRoutes } from "@/lib/routes";

/**
 * HOME-FEED1: the Home "start a post" box. It is the same one-shot handoff as
 * the Commerciale companion (COMM-TRUST1.D): the text moves, tab-scoped, into
 * the canonical chat + Distinta preview. No AI runs here and nothing is sent.
 */
const HANDOFF_KEY = "sss:commercial-ai-intake-handoff";

export function HomeAiComposer({ canWrite, organizationName }: { canWrite: boolean; organizationName: string }) {
  const router = useRouter();
  const [request, setRequest] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = request.trim();
    if (!canWrite || !ready || !value) return;
    try {
      sessionStorage.setItem(HANDOFF_KEY, value);
      setError("");
      router.push(appRoutes.commercial.home + "?compose=1&method=ai#commercial-ai-intake");
    } catch {
      setError("Non è stato possibile trasferire il testo. Apri la distinta e inseriscilo direttamente.");
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (ready && request.trim()) event.currentTarget.form?.requestSubmit();
    }
  }

  const initial = (organizationName.trim()[0] || "•").toUpperCase();

  if (!canWrite) {
    return (
      <section aria-label="Richieste di offerta" data-testid="home-ai-composer" className="rounded-2xl border border-[#dce5df] bg-white p-4">
        <p className="text-sm leading-6 text-[#52615b]">
          Accesso in sola lettura: puoi consultare feed, Network e storico, senza preparare richieste.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="home-ai-composer-heading" data-testid="home-ai-composer" className="rounded-2xl border border-[#dce5df] bg-white p-3 sm:p-4">
      <h2 id="home-ai-composer-heading" className="sr-only">Prepara una richiesta di offerta</h2>
      <form onSubmit={start} className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#176045] text-sm font-bold text-white">
          {initial}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="home-ai-composer-input" className="sr-only">Descrivi i tubi che ti servono</label>
          <textarea
            id="home-ai-composer-input"
            value={request}
            disabled={!ready}
            maxLength={12000}
            rows={2}
            onChange={(event) => setRequest(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Descrivi i tubi che ti servono: es. 40 tubi quadri 100×100×5, S355J2H, EN 10219…"
            className="min-h-[52px] w-full resize-y rounded-xl border border-[#c8dccf] bg-[#fafcfb] px-3 py-2 text-sm leading-5 text-[#143f30] placeholder:text-[#72877a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]"
          />
          {error ? <p role="alert" className="text-xs text-[#9d4e28]">{error}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] leading-4 text-[#5c7063]">L’assistente prepara una distinta in bozza: nessuna richiesta parte senza la tua conferma.</p>
            <button
              type="submit"
              disabled={!ready || !request.trim()}
              data-testid="home-ai-composer-submit"
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#176045] px-4 text-xs font-semibold !text-white hover:bg-[#114b36] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176045]"
            >
              Prepara la distinta →
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
