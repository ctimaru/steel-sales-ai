/**
 * RFQC1.3 — Buyer-only, read-only projection of one supplier conversation.
 * Never feed this projection to the token-based supplier portal. The supplier
 * portal has its own RFQH4/RFQH6 token-scoped RPCs.
 *
 * Keep source tables authoritative: no mirrored message/quote/event rows.
 */
export type Rfqc1TimelineKind =
  | "invitation" | "delivery" | "opened" | "message"
  | "quote" | "declined" | "award" | "purchase_order" | "system";

export type Rfqc1TimelineItem = {
  id: string;
  sourceId: string;
  supplierId: string;
  kind: Rfqc1TimelineKind;
  occurredAt: string;
  title: string;
  sender: "buyer" | "supplier" | "system";
  body?: string;
  messageType?: string;
  quote?: {
    revision: number;
    incoterm: string | null;
    paymentTerms: string | null;
    validityUntil: string | null;
    leadTimeDays: number | null;
    deliveryDate: string | null;
    lines: Array<{
      lineId: string;
      position: number;
      priceEurT: number | null;
      priceEurM: number | null;
      availability: string;
      deliveryDate: string | null;
    }>;
  };
  status?: string;
};

type Dispatch = {
  id: string; supplier_id: string;
  sent_at?: string | null;
  delivered_at?: string | null;
  opened_at?: string | null;
};
type NegotiationMessage = {
  id: string; supplier_id: string; sender_role: string; message_type: string;
  body: string; created_at: string;
};
type SupplierQuote = {
  id: string; supplier_id: string; revision_no: number;
  status: string; submitted_at?: string | null; declined_at?: string | null;
  incoterm?: string | null; payment_terms?: string | null;
  validity_until?: string | null; lead_time_days?: number | null;
  delivery_date?: string | null;
};
type QuoteLine = {
  quote_id: string; rfq_line_id: string; line_position: number;
  response_status: string; normalized_eur_t: number | string | null;
  normalized_eur_m: number | string | null;
  delivery_date?: string | null;
};
type RfqEvent = {
  id: string; supplier_id: string | null;
  event_type: string; created_at: string; event_sequence?: number | null;
};
type PurchaseOrder = {
  id: string; supplier_id: string; version_no: number;
  status: string; issued_at: string | null; supplier_responded_at?: string | null;
};

export type Rfqc1TimelineInput = {
  supplierId: string;
  dispatches: readonly Dispatch[];
  messages: readonly NegotiationMessage[];
  quotes: readonly SupplierQuote[];
  quoteLines: readonly QuoteLine[];
  events?: readonly RfqEvent[];
  purchaseOrders?: readonly PurchaseOrder[];
};

function finiteNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Only explicitly whitelisted event kinds may become visible chat items. */
const eventLabels: Record<string, string> = {
  supplier_added: "Fornitore selezionato",
  rfq_award_confirmed: "Aggiudicazione confermata",
  negotiation_bafo_requested: "BAFO richiesta",
  negotiation_revision_requested: "Revisione richiesta",
};

const eventKinds = new Set(["supplier_added", "rfq_award_confirmed"]);

/** An RFQH6 negotiation event is already represented by its message. */
function projectedEvent(event: RfqEvent, supplierId: string): Rfqc1TimelineItem | null {
  if (event.supplier_id !== supplierId || !eventKinds.has(event.event_type)) return null;
  return {
    id: "event:" + event.id, sourceId: event.id, supplierId,
    kind: event.event_type === "rfq_award_confirmed" ? "award" : "system",
    occurredAt: event.created_at, title: eventLabels[event.event_type],
    sender: "system",
  };
}

const rank: Record<Rfqc1TimelineKind, number> = {
  invitation: 0, delivery: 1, opened: 2, message: 3, quote: 4,
  declined: 4, award: 5, purchase_order: 6, system: 7,
};

/**
 * Isolation is enforced before projecting events; no source metadata is spread
 * into returned items. This is still a BUYER-ONLY model, never a substitute for
 * RLS or for the dedicated supplier token endpoints.
 */
export function buildRfqc1SupplierTimeline(input: Rfqc1TimelineInput): Rfqc1TimelineItem[] {
  if (!input.supplierId) return [];
  const supplierId = input.supplierId;
  const items: Rfqc1TimelineItem[] = [];
  const seen = new Set<string>();
  function add(item: Rfqc1TimelineItem) {
    if (item.supplierId !== supplierId || !Number.isFinite(Date.parse(item.occurredAt))) return;
    if (!seen.has(item.id)) { items.push(item); seen.add(item.id); }
  }

  for (const dispatch of input.dispatches) {
    if (dispatch.supplier_id !== supplierId) continue;
    if (dispatch.sent_at) add({
      id: "dispatch:" + dispatch.id + ":sent", sourceId: dispatch.id,
      supplierId, kind: "invitation", occurredAt: dispatch.sent_at,
      title: "Richiesta inviata", sender: "buyer",
    });
    if (dispatch.delivered_at) add({
      id: "dispatch:" + dispatch.id + ":delivered", sourceId: dispatch.id,
      supplierId, kind: "delivery", occurredAt: dispatch.delivered_at,
      title: "Email consegnata", sender: "system",
    });
    if (dispatch.opened_at) add({
      id: "dispatch:" + dispatch.id + ":opened", sourceId: dispatch.id,
      supplierId, kind: "opened", occurredAt: dispatch.opened_at,
      title: "Richiesta aperta", sender: "system",
    });
  }

  for (const msg of input.messages) {
    if (msg.supplier_id !== supplierId) continue;
    add({
      id: "message:" + msg.id, sourceId: msg.id, supplierId,
      kind: "message", occurredAt: msg.created_at, title:
        msg.message_type === "counter_target" ? "Counter target condiviso" :
        msg.message_type === "bafo_request" ? "BAFO richiesta" :
        msg.message_type === "revision_request" ? "Revisione richiesta" :
        msg.message_type === "clarification" ? "Chiarimento" : "Messaggio",
      sender: msg.sender_role === "buyer" ? "buyer" :
        msg.sender_role === "supplier" ? "supplier" : "system",
      body: msg.body, messageType: msg.message_type,
    });
  }

  for (const quote of input.quotes) {
    if (quote.supplier_id !== supplierId) continue;
    if (quote.status !== "submitted" && quote.status !== "superseded" && quote.status !== "declined") continue;
    const time = quote.status === "declined" ? quote.declined_at : quote.submitted_at;
    if (!time) continue;
    const isDeclined = quote.status === "declined";
    add({
      id: "quote:" + quote.id, sourceId: quote.id, supplierId,
      kind: isDeclined ? "declined" : "quote", occurredAt: time,
      title: isDeclined ? "Offerta declinata" : "Offerta · revisione " + quote.revision_no,
      sender: "supplier", status: quote.status,
      ...(!isDeclined ? { quote: {
        revision: quote.revision_no, incoterm: quote.incoterm ?? null,
        paymentTerms: quote.payment_terms ?? null,
        validityUntil: quote.validity_until ?? null,
        leadTimeDays: quote.lead_time_days ?? null,
        deliveryDate: quote.delivery_date ?? null,
        lines: input.quoteLines.filter(line => line.quote_id === quote.id)
          .map(line => ({
            lineId: line.rfq_line_id, position: line.line_position,
            priceEurT: finiteNumber(line.normalized_eur_t),
            priceEurM: finiteNumber(line.normalized_eur_m),
            availability: line.response_status,
            deliveryDate: line.delivery_date ?? null,
          })).sort((a, b) => a.position - b.position),
      } } : {}),
    });
  }

  for (const event of input.events ?? []) {
    const entry = projectedEvent(event, supplierId);
    if (entry) add(entry);
  }

  for (const po of input.purchaseOrders ?? []) {
    if (po.supplier_id !== supplierId) continue;
    if (po.issued_at) add({
      id: "po:" + po.id + ":issued", sourceId: po.id,
      supplierId, kind: "purchase_order", occurredAt: po.issued_at,
      title: "Ordine di acquisto · v" + po.version_no,
      sender: "buyer", status: po.status,
    });
    if (po.supplier_responded_at) add({
      id: "po:" + po.id + ":response", sourceId: po.id,
      supplierId, kind: "purchase_order", occurredAt: po.supplier_responded_at,
      title: "Risposta all'ordine · v" + po.version_no,
      sender: "supplier", status: po.status,
    });
  }

  return items.sort((a, b) => {
    const byTime = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
    return byTime || rank[a.kind] - rank[b.kind] || a.id.localeCompare(b.id);
  });
}
