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
      className={"relative min-w-0 overflow-hidden rounded-[20px] border border-white/60 bg-white p-4 sm:p-5 " + cinematic.companion}>
      <div className="flex min-w-0 items-center gap-3">
        <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#174f3a] text-lg text-white">✦</div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#3e7957]">Con l’assistente AI</p>
          <h3 id="commercial-ai-first-heading"
            className={"text-base font-semibold leading-tight tracking-[-0.02em] text-[#143f30] " + cinematic.companionTitle}>
            Descrivi i tubi che ti servono
          </h3>
        </div>
      </div>
      {canWrite ? (
        <form onSubmit={startRequest} data-testid="comm-cine11-prompt" aria-label="Prepara una nuova distinta nella chat"
          className={"mt-3 min-w-0 space-y-2 " + cinematic.companionForm}>
          <label htmlFor="commercial-ai-companion-input" className="sr-only">Descrivi il materiale</label>
          <textarea id="commercial-ai-companion-input" value={request} disabled={!ready} maxLength={12000} rows={3}
            onChange={(event) => setRequest(event.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder="Es. 40 tubi quadri 100×100×5, S355J2H, EN 10219, lunghi 6 m…"
            className="block min-h-[84px] w-full min-w-0 resize-y rounded-xl border border-[#b8d6c3] bg-white px-3 py-2.5 text-sm leading-5 text-[#143f30] placeholder:text-[#72877a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 flex-1 text-[11px] leading-4 text-[#5c7063]">
              La chat prepara la Distinta; nessuna richiesta viene inviata automaticamente.
            </p>
            <button type="submit" disabled={!ready || !request.trim()} data-testid="commercial-ai-first-cta"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#175640] px-5 text-sm font-semibold text-white hover:bg-[#104632] disabled:cursor-not-allowed disabled:opacity-50">
              Analizza con l’AI →
            </button>
          </div>
          {error ? <p role="alert" className="text-xs text-[#9d4e28]">{error}</p> : null}
          <p className="sr-only">
            Invio per continuare · Maiusc+Invio per andare a capo · Conferma prima di inviare.
          </p>
        </form>
      ) : (
        <p className="mt-3 text-xs leading-5 text-[#5c7063]">
          Consultazione in sola lettura. Puoi cercare nello storico e consultare le trattative, senza preparare o inviare richieste.
        </p>
      )}
    </section>
  );
}
