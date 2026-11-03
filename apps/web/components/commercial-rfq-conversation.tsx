"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { RfqAiIntakeMode } from "@/components/rfq-ai-intake-ux";

/** Purely local presentation history: not synchronized, saved or sent to suppliers.
 * Each Analyze click sends ONLY the current message to the existing AI action.
 * No claim of backend conversational memory is made. */
export type CommercialRfqTurn = {
  id: number;
  role: "user" | "assistant";
  content: string;
  state?: "result" | "error" | "accepted";
};

export function CommercialRfqConversation({
  mode, onModeChange, turns, value, onChange, onAnalyze, onClear, onSample,
  pending, error, hasProposals, review, manualTools,
}: {
  mode: RfqAiIntakeMode;
  onModeChange: (mode: RfqAiIntakeMode) => void;
  turns: CommercialRfqTurn[];
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  onClear: () => void;
  onSample: () => void;
  pending: boolean;
  error: string;
  hasProposals: boolean;
  review: ReactNode;
  manualTools: ReactNode;
}) {
  const chatEnd = useRef<HTMLDivElement>(null);
  const hasMounted = useRef(false);
  const canSubmit = value.trim().length >= 3 && !pending && !hasProposals && mode === "text";

  useEffect(() => {
    // Never scroll the page on initial mount, especially after a one-shot
    // home-to-composer handoff. On later turns only reveal the transcript end.
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    chatEnd.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [turns.length, pending, hasProposals]);

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (canSubmit) onAnalyze();
  }

  return (
    <section data-testid="commercial-rfq-gpt-conversation"
      aria-label="Conversazione per la creazione della distinta"
      className="flex min-h-[min(70dvh,670px)] min-w-0 flex-col">
      <div role="group" aria-label="Metodo di preparazione della distinta"
        data-testid="commercial-ai-focused-modes"
        className="mb-2 flex justify-end">
        <button type="button" aria-pressed={mode === "manual"}
          disabled={pending}
          onClick={() => onModeChange(mode === "manual" ? "text" : "manual")}
          className="min-h-10 rounded-lg px-2 text-xs font-semibold text-[#175640] underline underline-offset-4 disabled:opacity-50">
          {mode === "manual" ? "Torna alla conversazione" : "Preferisci configurare manualmente?"}
        </button>
      </div>

      {mode === "manual" ? (
        <section aria-label="Configuratore manuale" className="min-w-0 space-y-3">
          <p className="rounded-lg bg-[#eef5f0] px-3 py-2 text-xs text-[#36584b]">
            Configura un articolo manualmente. Torna alla conversazione per analizzare altri materiali.
          </p>
          {manualTools}
        </section>
      ) : (
        <>
          <div role="log" aria-label="Messaggi della richiesta" aria-live="polite"
            aria-relevant="additions"
            data-testid="commercial-rfq-message-thread"
            className="max-h-[min(65dvh,650px)] min-h-[min(43dvh,350px)] min-w-0 flex-1 space-y-4 overflow-y-auto px-1 pb-5 pt-2">
            {turns.length === 0 ? (
              <div data-testid="commercial-rfq-conversation-intro"
                className="flex items-start gap-3 pt-3">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#175640] text-xs font-bold text-white">S</span>
                <div className="max-w-[94%] min-w-0">
                  <p className="text-[15px] font-bold text-[#173f35]">Come posso aiutarti con la richiesta?</p>
                  <p className="mt-1 text-sm leading-6 text-[#53695d]">
                    Scrivi le misure come le diresti a un collega. Ti aiuterò a preparare
                    gli articoli da verificare nella Distinta a fianco.
                  </p>
                  {!value.trim() ? (
                    <button type="button" onClick={onSample} data-testid="commercial-rfq-sample"
                      className="mt-3 min-h-11 rounded-xl border border-[#c4d8ca] bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-[#175640] hover:bg-[#eef7f1]">
                      Prova: 40 tubi quadri 100×100×5, S355J2H, EN 10219, 12 m
                    </button>
                  ) : (
                    <p className="mt-3 text-xs font-medium text-[#315e49]">La tua richiesta è già nel campo di scrittura. Premi Analizza quando sei pronto.</p>
                  )}
                </div>
              </div>
            ) : null}

            {turns.map((turn) => (
              <div key={turn.id} data-testid={turn.role === "user" ? "commercial-rfq-user-message" : "commercial-rfq-assistant-message"}
                className={turn.role === "user" ? "flex justify-end" : "flex items-start gap-3"}>
                {turn.role === "assistant" ? (
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#175640] text-xs font-bold text-white">S</span>
                ) : null}
                <div className={turn.role === "user"
                  ? "max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-[#eaf3ee] px-4 py-3 text-sm leading-6 text-[#173f35]"
                  : "max-w-[calc(100%-2.75rem)] min-w-0 whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm bg-white px-3 py-2.5 text-sm leading-6 text-[#2c4738]"}>
                  {turn.content}
                </div>
              </div>
            ))}

            {pending ? (
              <div role="status" data-testid="commercial-rfq-thinking" className="flex items-center gap-3">
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#175640] text-xs font-bold text-white">S</span>
                <p className="text-sm text-[#52695b]">Sto analizzando le misure e i dati che hai scritto…</p>
              </div>
            ) : null}

            {review ? (
              <div data-testid="commercial-rfq-inline-review" className="min-w-0 pl-0 sm:pl-11">
                {review}
              </div>
            ) : null}

            {error ? (
              <p role="alert" data-testid="commercial-rfq-analysis-error"
                className="rounded-xl border border-[#e8cbb4] bg-[#fff8f2] px-3 py-2 text-sm text-[#8c431e]">
                {error} Il testo rimane disponibile per correggerlo e riprovare.
              </p>
            ) : null}
            <div ref={chatEnd} aria-hidden="true" />
          </div>

          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mt-auto border-t border-[#e0e9e2] bg-[#fbfdfb] pb-2 pt-3 md:bottom-3"
            data-testid="commercial-rfq-sticky-composer">
            <label htmlFor="rfqai2-text-input" className="sr-only">Scrivi la richiesta o altri articoli</label>
            <div className="rounded-2xl border border-[#b8d2c4] bg-white p-2 shadow-[0_6px_22px_rgba(19,65,43,0.06)] focus-within:border-[#175640]">
              <textarea id="rfqai2-text-input" rows={2} maxLength={12000}
                value={value} onChange={(event) => onChange(event.target.value)}
                onKeyDown={onComposerKeyDown}
                disabled={pending || hasProposals}
                placeholder={hasProposals ? "Verifica prima gli articoli proposti…" : "Scrivi misure, quantità, norma, lunghezza…"}
                className="min-h-[54px] max-h-44 w-full resize-y rounded-lg border-0 bg-transparent px-2 py-1 text-sm leading-6 text-[#173f35] outline-none placeholder:text-[#788d80] disabled:cursor-not-allowed disabled:opacity-60"
                spellCheck={false} />
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={onClear} disabled={!value.trim() || pending || hasProposals}
                  className="min-h-10 rounded-lg px-2 text-xs font-semibold text-[#52695b] underline underline-offset-4 disabled:opacity-40">
                  Cancella
                </button>
                <button type="button" onClick={onAnalyze} disabled={!canSubmit}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#175640] px-4 text-sm font-bold text-white hover:bg-[#104632] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:cursor-not-allowed disabled:opacity-50">
                  {pending ? "Analisi…" : value.trim().length > 0 && value.trim().length < 12 ? "Completa richiesta" : "Analizza la richiesta con AI"}
                  <span aria-hidden="true">↑</span>
                </button>
              </div>
            </div>
            <p className="mt-1 px-1 text-[11px] leading-4 text-[#67796f]">
              {hasProposals
                ? "Prima conferma o scarta le proposte. Poi puoi aggiungere altre righe."
                : value.trim().length > 0 && value.trim().length < 12
                  ? "Puoi completare questa misura: ti chiederò forma, quantità o lunghezza senza inventarle."
                  : "Invio esplicito all’AI · nessuna RFQ viene salvata o inviata automaticamente."}
            </p>
            <p className="sr-only">Invio per analizzare, Maiusc+Invio per andare a capo.</p>
          </div>
        </>
      )}
    </section>
  );
}
