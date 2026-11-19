// COMM-CYCLE1 (founder decisions, 19 Nov 2026) — azioni ed esiti del ciclo
// commerciale. Modulo puro: quali azioni offre una trattativa nel suo stato
// attuale e come si chiamano i motivi di chiusura. La scrittura vera passa solo
// da public.comm_cycle1_apply (permessi, profilo d'ufficio, transizioni).

export const CLOSE_REASONS = [
  { key: "price", label: "Prezzo" },
  { key: "lead_time", label: "Tempi di consegna" },
  { key: "material_unavailable", label: "Materiale non disponibile" },
  { key: "no_response", label: "Nessuna risposta" },
  { key: "offer_expired", label: "Offerta scaduta" },
  { key: "cancelled_by_customer", label: "Annullata dal cliente" },
  { key: "awarded_elsewhere", label: "Aggiudicata ad altri" },
  { key: "other", label: "Altro" },
] as const;

export type CloseReason = (typeof CLOSE_REASONS)[number]["key"];

export function closeReasonLabel(reason: string | null | undefined): string {
  return CLOSE_REASONS.find((r) => r.key === reason)?.label ?? "";
}

export function isCloseReason(value: unknown): value is CloseReason {
  return typeof value === "string" && CLOSE_REASONS.some((r) => r.key === value);
}

export type CycleRecordKind = "rfq" | "offer" | "order" | "campaign";
export type CycleActionKey =
  | "take_charge" | "offer_sent" | "offer_accepted" | "order_registered"
  | "order_confirmed" | "order_status" | "close_lost" | "reopen";

/** Lo stato grezzo dei documenti della trattativa (solo vendite). */
export type DealCycleState = {
  rfq: { id: string; status: string } | null;
  offer: { id: string; status: string; expired: boolean } | null;
  order: { id: string; status: string } | null;
};

/** Ultima chiusura come «non conclusa» ancora valida (null se riaperta o mai chiusa). */
export type DealOutcome = { reason: string; note: string | null; at: string | null };

export type CycleAction = {
  action: CycleActionKey;
  recordKind: CycleRecordKind;
  recordId: string;
  label: string;
  toStatus?: string;
  /** Chiede il riferimento d'ordine del cliente (facoltativo). */
  askOrderRef?: boolean;
};

const ORDER_NEXT: Record<string, { to: string; label: string }> = {
  confirmed: { to: "in_production", label: "In produzione" },
  in_production: { to: "ready", label: "Pronto" },
  ready: { to: "shipped", label: "Spedito" },
  shipped: { to: "delivered", label: "Consegnato" },
};

/**
 * L'azione principale (al massimo una) e se la trattativa si può chiudere come
 * non conclusa o riaprire. Rispecchia le transizioni ammesse dalla funzione SQL.
 */
export function dealCycleActions(cycle: DealCycleState | null | undefined, outcome: DealOutcome | null | undefined): {
  primary: CycleAction | null;
  secondary: CycleAction[];
  canClose: CycleAction | null;
  reopen: CycleAction | null;
} {
  const none = { primary: null, secondary: [], canClose: null, reopen: null };
  if (!cycle) return none;
  const anchor = cycle.rfq ? { kind: "rfq" as const, id: cycle.rfq.id }
    : cycle.offer ? { kind: "offer" as const, id: cycle.offer.id }
    : cycle.order ? { kind: "order" as const, id: cycle.order.id } : null;
  if (!anchor) return none;

  if (outcome) {
    return { ...none, reopen: { action: "reopen", recordKind: anchor.kind, recordId: anchor.id, label: "Riapri la trattativa" } };
  }

  const order = cycle.order && cycle.order.status !== "cancelled" ? cycle.order : null;
  const rfqClosed = cycle.rfq && ["closed_won", "closed_lost", "cancelled"].includes(cycle.rfq.status);
  let primary: CycleAction | null = null;
  const secondary: CycleAction[] = [];

  if (order) {
    if (order.status === "received") {
      primary = { action: "order_confirmed", recordKind: "order", recordId: order.id, label: "Conferma l'ordine" };
    } else if (ORDER_NEXT[order.status]) {
      const next = ORDER_NEXT[order.status];
      primary = { action: "order_status", recordKind: "order", recordId: order.id, label: "Segna: " + next.label, toStatus: next.to };
      if (next.to !== "delivered") {
        secondary.push({ action: "order_status", recordKind: "order", recordId: order.id, label: "Segna: Consegnato", toStatus: "delivered" });
      }
    }
  } else if (cycle.offer && !rfqClosed) {
    const s = cycle.offer.status;
    if (s === "draft") {
      primary = { action: "offer_sent", recordKind: "offer", recordId: cycle.offer.id, label: "Segna l'offerta come inviata" };
    } else if (s === "sent" || s === "expired") {
      primary = { action: "offer_accepted", recordKind: "offer", recordId: cycle.offer.id, label: "Offerta accettata dal cliente" };
    } else if (s === "accepted") {
      primary = { action: "order_registered", recordKind: "offer", recordId: cycle.offer.id, label: "Registra l'ordine", askOrderRef: true };
    }
  } else if (cycle.rfq && ["new", "review_needed", "qualified"].includes(cycle.rfq.status)) {
    primary = { action: "take_charge", recordKind: "rfq", recordId: cycle.rfq.id, label: "Prendi in carico" };
  }

  // Non si chiude come non conclusa una trattativa con un ordine già confermato
  // o in corso, né una già chiusa.
  const orderBlocks = order && order.status !== "received";
  const closed = rfqClosed || (!cycle.rfq && cycle.offer && !order && cycle.offer.status === "rejected")
    || (!cycle.rfq && !cycle.offer && cycle.order?.status === "cancelled");
  const canClose = orderBlocks || closed ? null
    : { action: "close_lost" as const, recordKind: anchor.kind, recordId: anchor.id, label: "Chiudi come non conclusa" };
  return { primary, secondary, canClose, reopen: null };
}

/** Riga di testo dell'esito nell'elenco: «Non conclusa · Prezzo». */
export function outcomeText(outcome: DealOutcome | null | undefined): string {
  if (!outcome) return "";
  const reason = closeReasonLabel(outcome.reason);
  return "Non conclusa" + (reason ? " · " + reason : "");
}

type EventRow = { deal_kind?: unknown; deal_id?: unknown; action?: unknown; reason?: unknown; note?: unknown; created_at?: unknown };

/**
 * Dagli eventi (più recenti prima) l'esito ancora valido di ogni trattativa:
 * l'ultima chiusura, se dopo non c'è stata una riapertura.
 */
export function outcomesFromEvents(rows: unknown): Map<string, DealOutcome> {
  const result = new Map<string, DealOutcome>();
  const seen = new Set<string>();
  if (!Array.isArray(rows)) return result;
  for (const row of rows as EventRow[]) {
    if (!row || typeof row !== "object") continue;
    const key = String(row.deal_kind ?? "") + ":" + String(row.deal_id ?? "");
    if (seen.has(key)) continue;
    if (row.action !== "close_lost" && row.action !== "reopen") continue;
    seen.add(key);
    if (row.action === "close_lost" && typeof row.reason === "string") {
      result.set(key, {
        reason: row.reason,
        note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
        at: typeof row.created_at === "string" ? row.created_at : null,
      });
    }
  }
  return result;
}
