"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { appRoutes } from "@/lib/routes";
import cinematic from "@/components/commercial-cinematic.module.css";

/**
 * COMM-TRUST1.D — one entry to the existing COMM-RFQ-UX2 conversation.
 * This is not a second chatbot: a user-confirmed, tab-scoped one-shot handoff
 * opens the canonical chat + Distinta preview. AI never runs on this surface.
 */
export function CommercialAiCompanion({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const [request, setRequest] = useState("");
  const [error, setError] = useState("");
  // The first keystroke on mobile must not be lost before hydration.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  function startRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = request.trim();
    if (!canWrite || !ready || !value) return;
    try {
      sessionStorage.setItem("sss:commercial-ai-intake-handoff", value);
      setError("");
      router.push(appRoutes.commercial.home + "?compose=1&method=ai#commercial-ai-intake");
    } catch {
      setError("Non è stato possibile trasferire il testo. Apri la distinta e inseriscilo direttamente.");
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Match the conversation screen: Enter starts, Shift+Enter adds a line.
    // Never submit half-composed input from an IME.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (ready && request.trim()) event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <section aria-labelledby="commercial-ai-first-heading" data-testid="commercial-ai-first"
      className={"relative overflow-hidden rounded-[20px] border border-[#d7e8dd] bg-white p-2.5 sm:px-4 sm:py-2.5 " + cinematic.companion}>
      <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#174f3a] text-lg text-white">✦</div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#3e7957]">Prepara una distinta · Assistente AI</p>
            <h2 id="commercial-ai-first-heading"
              className={"mt-0.5 text-[clamp(1.1rem,1.5vw,1.35rem)] font-semibold leading-[1.16] tracking-[-0.035em] text-[#143f30] " + cinematic.companionTitle}>
              Descrivi i tubi che ti servono
            </h2>
            <p className="mt-0.5 text-xs leading-4 text-[#5c7063]">
              Continua nella chat con l’anteprima della Distinta a lato; nessuna richiesta viene inviata automaticamente.
            </p>
          </div>
        </div>
        {canWrite ? (
          <form onSubmit={startRequest} data-testid="comm-cine11-prompt" aria-label="Prepara una nuova distinta nella chat"
            className={"min-w-0 space-y-1.5 " + cinematic.companionForm}>
            <label htmlFor="commercial-ai-companion-input" className="sr-only">Descrivi il materiale</label>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
              <textarea id="commercial-ai-companion-input" value={request} disabled={!ready} maxLength={12000} rows={2}
                onChange={(event) => setRequest(event.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder="Es. 40 tubi quadri 100×100×5, S355J2H, EN 10219, lunghi 6 m…"
                className="min-h-[52px] min-w-0 flex-1 resize-y rounded-xl border border-[#b8d6c3] bg-white px-3 py-2 text-sm leading-5 text-[#143f30] placeholder:text-[#72877a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]" />
              <button type="submit" disabled={!ready || !request.trim()} data-testid="commercial-ai-first-cta"
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-[#175640] px-4 text-xs font-semibold text-white hover:bg-[#104632] disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-[164px]">
                Apri chat e anteprima →
              </button>
            </div>
            {error ? <p role="alert" className="text-xs text-[#9d4e28]">{error}</p> : null}
            <p className="text-[11px] leading-4 text-[#5c7063]">
              Invio per continuare · Maiusc+Invio per andare a capo · L’analisi AI richiede una tua conferma.
            </p>
          </form>
        ) : (
          <p className="text-xs leading-5 text-[#5c7063]">
            Consultazione in sola lettura. Puoi cercare nello storico e consultare le trattative, senza preparare o inviare richieste.
          </p>
        )}
      </div>
    </section>
  );
}
