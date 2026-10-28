"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { appRoutes } from "@/lib/routes";

type DealFactBriefProps = {
  kind: string;
  status: string;
  title: string;
  origin: string;
};

export function CommercialDealFactBriefCopy({ kind, status, title, origin }: DealFactBriefProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [question, setQuestion] = useState("Quali informazioni dobbiamo verificare prima del prossimo passo?");
  const contextText = [
      "Contesto della trattativa (dati mostrati nella scheda):",
      "Tipo: " + kind,
      "Stato: " + status,
      "Oggetto: " + title,
      "Origine: " + origin,
      "Domanda: " + question.trim(),
      "Non dedurre offerte, email o documenti non presenti in questi dati.",
    ].join("\n");
  async function copyFacts(openAssistant = false) {
    if (!question.trim()) {
      setFeedback("Inserisci una domanda prima di copiare il contesto.");
      return;
    }
    try {
      await navigator.clipboard.writeText(contextText);
      setFeedback("Contesto copiato. Incollalo nell’assistente solo se desideri condividerlo.");
      if (openAssistant) router.push(appRoutes.commercial.assistant);
    } catch {
      setFeedback("Copia non disponibile. Puoi consultare i dati direttamente nella scheda.");
    }
  }
  return (
    <div className="mt-3 space-y-2" data-testid="commercial-deal-copy-brief">
      <p className="text-[11px] font-semibold text-[var(--brand-deep)]">Che cosa vuoi approfondire?</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Domanda per l’assistente">
        {[
          "Quali informazioni dobbiamo verificare prima del prossimo passo?",
          "Quali condizioni commerciali mancano per valutare questa trattativa?",
          "Quali dati tecnici servono per preparare una risposta accurata?",
        ].map((option) => (
          <button key={option} type="button" onClick={() => { setQuestion(option); setFeedback(""); }} aria-pressed={question === option}
            className={question === option
              ? "rounded-lg border border-[#175640] bg-[#edf7f1] px-3 py-2 text-xs font-semibold text-[#175640]"
              : "rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--brand-primary-soft)]"}>{option}</button>
        ))}
      </div>
      <label htmlFor="commercial-deal-ai-question" className="block text-[11px] font-semibold text-[var(--brand-deep)]">Personalizza la domanda</label>
      <textarea id="commercial-deal-ai-question" value={question} onChange={(event) => { setQuestion(event.target.value); setFeedback(""); }} rows={2} maxLength={500}
        className="w-full resize-y rounded-lg border border-[var(--border-strong)] bg-white p-2.5 text-xs text-[var(--brand-deep)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246c53]" />
      <details className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5 text-xs">
        <summary className="cursor-pointer font-semibold text-[var(--brand-deep)]">Anteprima esatta del contesto da copiare</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words text-[var(--text-secondary)]">{contextText}</pre>
      </details>
      <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void copyFacts()}
        className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border-strong)] bg-white px-3 text-xs font-semibold text-[var(--brand-deep)] hover:bg-[var(--brand-primary-soft)]">
        Copia contesto per l’assistente
      </button>
      <button type="button" onClick={() => void copyFacts(true)}
        className="inline-flex min-h-10 items-center rounded-lg bg-[#175640] px-3 text-xs font-semibold text-white hover:bg-[#104632] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246c53]">
        Copia e apri assistente →
      </button>
      <p role="status" aria-live="polite" className="text-xs text-[var(--text-secondary)]">{feedback}</p>
      </div>
    </div>
  );
}
