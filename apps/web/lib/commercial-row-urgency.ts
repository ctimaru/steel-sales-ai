// COMM-DESK-AI1.B — urgenza di una riga della lista Commerciale.
// Solo stato, tipo e scadenza già letti dai record autorizzati: nessun testo
// libero, nessuna stima. L'ordinamento vale all'interno della pagina caricata;
// la paginazione resta cronologica.

export type CommercialRowUrgency = "due" | "reply" | "draft" | "progress" | "done";
export type CommercialRowGroup = "now" | "complete" | "rest";

export const COMMERCIAL_DUE_WINDOW_DAYS = 7;

const replyStatuses = new Set(["nuova", "ricevuto", "aperta", "in lavorazione", "modifica richiesta"]);
const draftStatuses = new Set(["bozza", "bozza po", "pronta"]);
const doneStatuses = new Set([
  "rifiutata", "rifiutato", "annullata", "annullato", "scaduta", "chiusa", "completato", "aggiudicata",
]);
const inboundToAnswer = new Set(["inbound-rfq", "inbound-order"]);
const withDeadline = new Set(["inbound-rfq", "campaign"]);

export function commercialRowUrgency(
  kind: string, status: string, dueAt?: string | null, now: number = Date.now(),
): CommercialRowUrgency {
  const key = status.trim().toLocaleLowerCase("it-IT");
  if (doneStatuses.has(key)) return "done";
  const due = dueAt ? Date.parse(dueAt) : NaN;
  if (withDeadline.has(kind) && Number.isFinite(due) && due <= now + COMMERCIAL_DUE_WINDOW_DAYS * 86_400_000) return "due";
  // Una risposta fornitore ricevuta va valutata: è lavoro di chi legge.
  if (kind === "quote") return "reply";
  if (replyStatuses.has(key) && (inboundToAnswer.has(kind) || key === "modifica richiesta")) return "reply";
  if (draftStatuses.has(key)) return "draft";
  return "progress";
}

const rank: Record<CommercialRowUrgency, number> = { due: 0, reply: 1, draft: 2, progress: 3, done: 4 };

export function commercialRowGroup(urgency: CommercialRowUrgency): CommercialRowGroup {
  return urgency === "due" || urgency === "reply" ? "now" : urgency === "draft" ? "complete" : "rest";
}

export const commercialRowGroupLabels: Record<CommercialRowGroup, string> = {
  now: "Da fare adesso", complete: "Da completare", rest: "In corso e concluse",
};

/** Ordinamento stabile: a parità di urgenza resta l'ordine cronologico ricevuto. */
export function sortByCommercialUrgency<T>(items: readonly T[], urgencyOf: (item: T) => CommercialRowUrgency): T[] {
  return items
    .map((item, index) => ({ item, index, order: rank[urgencyOf(item)] }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((entry) => entry.item);
}

/** «Scade il …» / «Scaduta il …» solo con una data valida. */
export function commercialDueLabel(dueAt: string | null | undefined, formatted: string, now: number = Date.now()): string | null {
  const due = dueAt ? Date.parse(dueAt) : NaN;
  if (!Number.isFinite(due)) return null;
  return (due < now ? "Scaduta il " : "Scade il ") + formatted;
}
