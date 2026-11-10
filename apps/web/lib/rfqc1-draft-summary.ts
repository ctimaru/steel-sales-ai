/**
 * Chat RFQ, passo 3: riepilogo della bozza prima dell'invio.
 * Funzione pura. Non invia nulla: l'invio resta nel pannello di revisione,
 * con la conferma esplicita finale.
 *
 * Obbligatori: almeno un articolo, ogni articolo con norma, descrizione/dimensioni
 * e quantità positiva, almeno un fornitore con email.
 * Consigliati, non bloccanti: qualità del materiale, scadenza risposte.
 */
export type DraftSummaryLine = {
  description: string;
  standard: string | null;
  grade: string | null;
  quantity: number | string;
};
export type DraftSummarySupplier = { name: string; email: string | null };
export type DraftSummaryCheck = {
  key: "lines" | "standard" | "quantity" | "suppliers" | "emails" | "grade" | "due";
  ok: boolean;
  blocking: boolean;
  label: string;
};

export function summarizeRfqDraft(input: {
  status: string;
  lines: readonly DraftSummaryLine[];
  suppliers: readonly DraftSummarySupplier[];
  dueAt: string | null;
}): { applies: boolean; ready: boolean; checks: DraftSummaryCheck[]; missing: string[] } {
  const applies = input.status === "draft" || input.status === "ready";
  const lineNumber = (value: number | string) => Number(value);
  const noStandard = input.lines.filter((l) => !(l.standard ?? "").trim()).length;
  const noQuantity = input.lines.filter((l) => !(lineNumber(l.quantity) > 0)).length;
  const noGrade = input.lines.filter((l) => !(l.grade ?? "").trim()).length;
  const noEmail = input.suppliers.filter((s) => !(s.email ?? "").trim()).length;
  const dueOk = Boolean(input.dueAt && Number.isFinite(Date.parse(input.dueAt)));

  const checks: DraftSummaryCheck[] = [
    { key: "lines", blocking: true, ok: input.lines.length > 0,
      label: input.lines.length ? input.lines.length + (input.lines.length === 1 ? " articolo" : " articoli") : "Nessun articolo nella distinta" },
    { key: "standard", blocking: true, ok: noStandard === 0,
      label: noStandard ? "Norma mancante in " + noStandard + (noStandard === 1 ? " articolo" : " articoli") : "Norma indicata per ogni articolo" },
    { key: "quantity", blocking: true, ok: noQuantity === 0,
      label: noQuantity ? "Quantità mancante in " + noQuantity + (noQuantity === 1 ? " articolo" : " articoli") : "Quantità indicata per ogni articolo" },
    { key: "suppliers", blocking: true, ok: input.suppliers.length > 0,
      label: input.suppliers.length ? input.suppliers.length + (input.suppliers.length === 1 ? " fornitore" : " fornitori") : "Nessun fornitore selezionato" },
    { key: "emails", blocking: true, ok: noEmail === 0,
      label: noEmail ? "Email mancante per " + noEmail + (noEmail === 1 ? " fornitore" : " fornitori") : "Email presente per ogni fornitore" },
    { key: "grade", blocking: false, ok: noGrade === 0,
      label: noGrade ? "Qualità del materiale mancante in " + noGrade + (noGrade === 1 ? " articolo (consigliata)" : " articoli (consigliata)") : "Qualità indicata per ogni articolo" },
    { key: "due", blocking: false, ok: dueOk,
      label: dueOk ? "Scadenza risposte impostata" : "Scadenza risposte non impostata (consigliata)" },
  ];
  const missing = checks.filter((c) => c.blocking && !c.ok).map((c) => c.label);
  return { applies, ready: applies && missing.length === 0, checks, missing };
}
