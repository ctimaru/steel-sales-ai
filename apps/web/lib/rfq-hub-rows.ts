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
  attention: { label: string; urgent: boolean } | null;
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
 * Open actions from the procurement queue (rfqh10_procurement_inbox), first
 * per RFQ (the queue is already ordered by priority).
 */
export function rfqHubAttentionByRfq(value: unknown): Map<string, { label: string; urgent: boolean }> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const byRfq = new Map<string, { label: string; urgent: boolean }>();
  for (const raw of items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    if (item.requires_action !== true || typeof item.rfq_id !== "string" || byRfq.has(item.rfq_id)) continue;
    const label = typeof item.action_label === "string" && item.action_label.trim()
      ? item.action_label.trim().slice(0, 80)
      : typeof item.headline === "string" ? item.headline.trim().slice(0, 80) : "Da verificare";
    byRfq.set(item.rfq_id, { label, urgent: item.priority === "urgent" || item.priority === "high" });
  }
  return byRfq;
}

/** Count shown next to «Centro RFQ» in the menu. */
export function rfqHubAttentionCount(value: unknown): number {
  const map = rfqHubAttentionByRfq(value);
  return map ? map.size : 0;
}
