/**
 * RFQHUB1 (founder decision, 18 Nov 2026): Centro RFQ = one row per Distinta,
 * showing how far its request got. Pure display logic, no data access.
 */

export type RfqHubRowCampaign = {
  id: string;
  status: string;
  due_at: string | null;
  created_at: string;
};

export type RfqHubRowFacts = {
  /** Latest RFQ created from the Distinta, if any. */
  campaign: RfqHubRowCampaign | null;
  /** Earlier RFQs created from the same Distinta. */
  previousCount: number;
  supplierCount: number;
  /** Suppliers with at least one submitted (current) quote. */
  respondedCount: number;
  /** Latest purchase order status for the campaign, if any. */
  orderStatus: string | null;
  /** First open action from the procurement queue for this RFQ. */
  attention: { label: string | null; urgent: boolean } | null;
  /** RFQHUB1D: archived Distinte show «Archiviata», whatever their RFQ says. */
  archived?: boolean;
};

export type RfqHubRowTone = "draft" | "todo" | "waiting" | "offers" | "done" | "closed";

export type RfqHubRowState = {
  label: string;
  tone: RfqHubRowTone;
  /** Where the row opens. */
  target: "distinta" | "step2" | "step3" | "rfq";
};

const orderLabels: Record<string, string> = {
  draft: "Ordine in bozza",
  issued: "Ordine emesso · attesa conferma",
  supplier_confirmed: "Ordine confermato",
  supplier_rejected: "Ordine rifiutato",
  change_requested: "Ordine: modifica richiesta",
  cancelled: "Ordine annullato",
};

export function rfqHubRowState(facts: RfqHubRowFacts): RfqHubRowState {
  const { campaign } = facts;
  if (facts.archived) return { label: "Archiviata", tone: "closed", target: campaign ? "rfq" : "distinta" };
  if (!campaign) return { label: "Bozza · fornitori da scegliere", tone: "draft", target: "distinta" };

  switch (campaign.status) {
    case "draft":
    case "ready":
      return facts.supplierCount > 0
        ? { label: "Da inviare · " + facts.supplierCount + (facts.supplierCount === 1 ? " destinatario" : " destinatari"), tone: "todo", target: "step3" }
        : { label: "Fornitori da scegliere", tone: "todo", target: "step2" };
    case "launched":
    case "collecting":
      return facts.respondedCount > 0
        ? { label: "Offerte da confrontare · " + facts.respondedCount + " su " + facts.supplierCount, tone: "offers", target: "rfq" }
        : { label: "In attesa · 0 risposte su " + facts.supplierCount, tone: "waiting", target: "rfq" };
    case "awarded":
      return {
        label: facts.orderStatus ? (orderLabels[facts.orderStatus] ?? "Aggiudicata") : "Aggiudicata · ordine da preparare",
        tone: facts.orderStatus === "supplier_confirmed" ? "done" : "todo",
        target: "rfq",
      };
    case "closed":
      return { label: "Chiusa", tone: "closed", target: "rfq" };
    case "cancelled":
      return { label: "Annullata", tone: "closed", target: "rfq" };
    default:
      return { label: "Stato da verificare", tone: "waiting", target: "rfq" };
  }
}

export const rfqHubToneClass: Record<RfqHubRowTone, string> = {
  draft: "bg-[#eef2f0] text-[#3f544a]",
  todo: "bg-[#fff1d6] text-[#7a4d0e]",
  waiting: "bg-[#e8f0f6] text-[#284f6b]",
  offers: "bg-[#dcf1e4] text-[#145234]",
  done: "bg-[#e3efe8] text-[#1f5a3f]",
  closed: "bg-[#f1f1ef] text-[#55594f]",
};

export type RfqHubView = "attive" | "da-gestire" | "archiviate";

export function rfqHubView(raw: unknown): RfqHubView {
  return raw === "da-gestire" || raw === "archiviate" ? raw : "attive";
}

/** Old addresses (/rfq-hub/inbox, /rfq-hub/distinte) land on the matching view. */
export function rfqHubHref(view: RfqHubView, query = "", page = 1): string {
  const params = new URLSearchParams();
  if (view !== "attive") params.set("vista", view);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return "/rfq-hub" + (search ? "?" + search : "");
}

/**
 * What the row asks you to do, from the procurement queue's action_code.
 * null = the row state already says it (e.g. «Da inviare», «Offerte da
 * confrontare») or there is nothing to do: no repeated or English text.
 */
const attentionLabels: Record<string, string | null> = {
  add_suppliers: null,
  launch_rfq: null,
  review_quotes: null,
  monitor_rfq: null,
  monitor_po: null,
  monitor_negotiation: null,
  recover_dispatch: "Alcuni invii non sono partiti",
  follow_up_rfq: "Scaduta: sollecita i fornitori",
  review_po_change: "Il fornitore chiede di modificare l'ordine",
  review_po_rejection: "Ordine rifiutato: rivedilo",
  recover_po_delivery: "Invio dell'ordine non riuscito",
  issue_po: "Ordine pronto da emettere",
  follow_up_po: "Conferma dell'ordine scaduta: sollecita",
  review_bafo: "Offerta finale ricevuta: valutala",
  respond_negotiation: "Il fornitore aspetta una tua risposta",
  follow_up_negotiation: "Trattativa scaduta: sollecita",
};

/**
 * RFQHUB1D (founder decision, 18 Nov 2026): «Da gestire» = something waits
 * for you (offers, deadlines, failed sends, orders, negotiations). A draft
 * still to prepare or send stays in «Attive».
 */
const draftOnlyCodes = new Set(["add_suppliers", "launch_rfq"]);

export function rfqHubAttentionLabel(actionCode: unknown): string | null {
  return typeof actionCode === "string" ? attentionLabels[actionCode] ?? null : null;
}

/**
 * Open actions from the procurement queue (rfqh10_procurement_inbox), one per
 * RFQ. The queue is already ordered by priority: the first open item decides
 * urgency; the label is the first one that adds something to the row state.
 */
export function rfqHubAttentionByRfq(value: unknown): Map<string, { label: string | null; urgent: boolean }> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const byRfq = new Map<string, { label: string | null; urgent: boolean }>();
  for (const raw of items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    if (item.requires_action !== true || typeof item.rfq_id !== "string") continue;
    if (typeof item.action_code === "string" && draftOnlyCodes.has(item.action_code)) continue;
    const label = rfqHubAttentionLabel(item.action_code);
    const existing = byRfq.get(item.rfq_id);
    if (existing) {
      if (!existing.label && label) existing.label = label;
      continue;
    }
    byRfq.set(item.rfq_id, { label, urgent: item.priority === "urgent" || item.priority === "high" });
  }
  return byRfq;
}

/** Count shown next to «Centro RFQ» in the menu. */
export function rfqHubAttentionCount(value: unknown): number {
  const map = rfqHubAttentionByRfq(value);
  return map ? map.size : 0;
}

/** «a Alessio Tubi», «a Alessio Tubi e altri 2»: who the request goes to. */
export function rfqHubRecipientsLabel(names: string[]): string | null {
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!clean.length) return null;
  const first = clean[0].length > 40 ? clean[0].slice(0, 39) + "…" : clean[0];
  return clean.length === 1 ? "a " + first : "a " + first + " e " + (clean.length === 2 ? "1 altro" : "altri " + (clean.length - 1));
}

/** First articles of a Distinta, so rows with the same name can be told apart. */
export function rfqHubArticlesLabel(descriptions: string[], lineCount: number): string | null {
  const clean = descriptions.map((d) => d.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 2);
  if (!clean.length) return null;
  const rest = Math.max(0, lineCount - clean.length);
  return clean.join(" · ") + (rest ? " + " + rest + (rest === 1 ? " altro" : " altri") : "");
}

const DEFAULT_DISTINTA_TITLE = "Richiesta di offerta";

/**
 * A Distinta saved with the default name takes its name from the first
 * article: «RHS 200x100x6 + 1 articolo». A name typed by the user is kept.
 */
export function distintaAutoTitle(title: string, descriptions: string[]): string {
  const typed = title.trim();
  if (typed && typed !== DEFAULT_DISTINTA_TITLE) return typed;
  const first = descriptions.map((d) => d.replace(/\s+/g, " ").trim()).find(Boolean);
  if (!first) return typed || DEFAULT_DISTINTA_TITLE;
  const others = descriptions.filter((d) => d.trim()).length - 1;
  const head = first.length > 80 ? first.slice(0, 79) + "…" : first;
  return head + (others > 0 ? " + " + others + (others === 1 ? " articolo" : " articoli") : "");
}
