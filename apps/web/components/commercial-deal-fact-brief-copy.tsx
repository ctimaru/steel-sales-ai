"use client";

import { useState } from "react";

type DealFactBriefProps = {
  kind: string;
  status: string;
  title: string;
  origin: string;
};

export function CommercialDealFactBriefCopy({ kind, status, title, origin }: DealFactBriefProps) {
  const [feedback, setFeedback] = useState("");
  const [question, setQuestion] = useState("Quali informazioni dobbiamo verificare prima del prossimo passo?");
  async function copyFacts() {
    const text = [
      "Contesto della trattativa (dati mostrati nella scheda):",
      "Tipo: " + kind,
      "Stato: " + status,
      "Oggetto: " + title,
      "Origine: " + origin,
      "Domanda: " + question,
      "Non dedurre offerte, email o documenti non presenti in questi dati.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Contesto copiato. Incollalo nell’assistente solo se desideri condividerlo.");
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
      <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={copyFacts}
        className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border-strong)] bg-white px-3 text-xs font-semibold text-[var(--brand-deep)] hover:bg-[var(--brand-primary-soft)]">
        Copia contesto per l’assistente
      </button>
      <p role="status" aria-live="polite" className="text-xs text-[var(--text-secondary)]">{feedback}</p>
      </div>
    </div>
  );
}
