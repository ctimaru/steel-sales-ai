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
  async function copyFacts() {
    const text = [
      "Contesto della trattativa (dati mostrati nella scheda):",
      "Tipo: " + kind,
      "Stato: " + status,
      "Oggetto: " + title,
      "Origine: " + origin,
      "Domanda: quali informazioni dobbiamo verificare prima del prossimo passo?",
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
    <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="commercial-deal-copy-brief">
      <button type="button" onClick={copyFacts}
        className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border-strong)] bg-white px-3 text-xs font-semibold text-[var(--brand-deep)] hover:bg-[var(--brand-primary-soft)]">
        Copia contesto per l’assistente
      </button>
      <p role="status" aria-live="polite" className="text-xs text-[var(--text-secondary)]">{feedback}</p>
    </div>
  );
}
