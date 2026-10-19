import "server-only";

import { getExplorerData } from "@/lib/commercial-data";
import { formatHubDate, rfqCampaignStatusLabel, rfqOrderStatusLabel } from "@/lib/rfq-hub-overview";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export type CommercialView = "all" | "received" | "sent" | "offers" | "orders" | "drafts";
export type UnifiedCommercialKind = "inbound-rfq" | "inbound-offer" | "inbound-order" | "campaign" | "quote" | "purchase-order" | "distinta";
export type UnifiedCommercialItem = {
  key: string;
  id: string;
  kind: UnifiedCommercialKind;
  view: Exclude<CommercialView, "all">;
  title: string;
  subtitle: string;
  status: string;
  at: string | null;
  href: string;
  campaignId: string | null;
  origin: "memoria privata" | "acquisti privati";
};
export type UnifiedCommercialData = {
  items: UnifiedCommercialItem[];
  partial: boolean;
  inboundUnavailable: boolean;
  procurementUnavailable: boolean;
  truncated: boolean;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validId(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}

function asLabel(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

// Each channel retains its own canonical entity and Supabase RLS. This is a
// read-only presentation model; it does not translate buyer RFQ to inbound RFQ.
export async function loadUnifiedCommercialData(organizationId: string): Promise<UnifiedCommercialData> {
  const db = await createClient();
  const [inbound, campaigns, quotes, purchaseOrders, saved] = await Promise.all([
    getExplorerData({ role: "all" }).catch(() => null),
    db.from("buyer_rfq_campaigns")
      .select("id,title,status,due_at,created_at,source_distinta_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).limit(60),
    db.from("buyer_rfq_quotes")
      .select("id,rfq_id,status,revision_no,submitted_at")
      .eq("organization_id", organizationId).eq("status", "submitted")
      .order("submitted_at", { ascending: false }).limit(40),
    db.from("buyer_purchase_order_drafts")
      .select("id,rfq_id,po_draft_ref,status,supplier_name_snapshot,total_eur,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).limit(40),
    db.from("buyer_distintas")
      .select("id,title,line_count,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).limit(40),
  ]);

  const items: UnifiedCommercialItem[] = [];
  const seen = new Set<string>();
  function push(item: UnifiedCommercialItem) {
    if (seen.has(item.key)) return;
    seen.add(item.key);
    items.push(item);
  }

  const inboundUnavailable = !inbound || inbound.mode === "awaiting_assignment";
  if (inbound?.mode === "live") {
    for (const row of inbound.rows) {
      const kind = row.role === "requested" ? "inbound-rfq" : row.role === "offered" ? "inbound-offer" : row.role === "ordered" ? "inbound-order" : null;
      const view = row.role === "requested" ? "received" : row.role === "offered" ? "offers" : row.role === "ordered" ? "orders" : null;
      const href = row.operationalHref;
      const id = href?.split("/").at(-1);
      if (!kind || !view || !validId(id) || !href) continue;
      push({
        key: kind + ":" + id, id, kind, view,
        title: row.company || "Cliente non attribuito",
        subtitle: [row.product, row.standard, row.grade].filter(Boolean).join(" · "),
        status: row.role === "requested" ? "Richiesta nello storico" : row.role === "offered" ? "Offerta nello storico" : "Ordine nello storico",
        // The explorer formats its date. Never fabricate a timestamp from it.
        at: null,
        href, campaignId: null, origin: "memoria privata",
      });
    }
  }

  const visibleCampaigns = new Map<string, { title: string; status: string; created_at: string | null; due_at: string | null }>();
  if (!campaigns.error) {
    for (const campaign of campaigns.data ?? []) {
      if (!validId(campaign.id)) continue;
      visibleCampaigns.set(campaign.id, {
        title: asLabel(campaign.title, "Richiesta ai fornitori"),
        status: asLabel(campaign.status, "—"),
        created_at: campaign.created_at ?? null,
        due_at: campaign.due_at ?? null,
      });
      push({
        key: "campaign:" + campaign.id, id: campaign.id, kind: "campaign", view: "sent",
        title: asLabel(campaign.title, "Richiesta ai fornitori"),
        subtitle: campaign.due_at ? "Scadenza " + formatHubDate(campaign.due_at) : "Campagna privata multi-fornitore",
        status: rfqCampaignStatusLabel(campaign.status),
        at: campaign.created_at ?? null,
        href: appRoutes.rfqHub.campaign(campaign.id), campaignId: campaign.id, origin: "acquisti privati",
      });
    }
  }

  // A quote/PO is shown only when its campaign is visible to this workspace.
  // The underlying queries are tenant-scoped AND still subject to Supabase RLS.
  if (!quotes.error && !campaigns.error) for (const quote of quotes.data ?? []) {
    if (!validId(quote.id) || !validId(quote.rfq_id)) continue;
    const campaign = visibleCampaigns.get(quote.rfq_id);
    if (!campaign) continue;
    push({
      key: "quote:" + quote.id, id: quote.id, kind: "quote", view: "offers",
      title: campaign.title,
      subtitle: "Offerta fornitore · revisione " + String(quote.revision_no ?? "—"),
      status: "Offerta ricevuta", at: quote.submitted_at ?? null,
      href: appRoutes.rfqHub.campaign(quote.rfq_id),
      campaignId: quote.rfq_id, origin: "acquisti privati",
    });
  }
  if (!purchaseOrders.error && !campaigns.error) for (const order of purchaseOrders.data ?? []) {
    if (!validId(order.id) || !validId(order.rfq_id)) continue;
    const campaign = visibleCampaigns.get(order.rfq_id);
    if (!campaign) continue;
    push({
      key: "purchase-order:" + order.id, id: order.id, kind: "purchase-order", view: "orders",
      title: asLabel(order.po_draft_ref, "Purchase Order"),
      subtitle: asLabel(order.supplier_name_snapshot, campaign.title),
      status: rfqOrderStatusLabel(order.status),
      at: order.created_at ?? null, href: appRoutes.rfqHub.campaign(order.rfq_id),
      campaignId: order.rfq_id, origin: "acquisti privati",
    });
  }

  if (!saved.error) for (const draft of saved.data ?? []) {
    if (!validId(draft.id)) continue;
    push({
      key: "distinta:" + draft.id, id: draft.id, kind: "distinta", view: "drafts",
      title: asLabel(draft.title, "Distinta privata"),
      subtitle: String(draft.line_count ?? "—") + " righe · distinta salvata",
      status: "Salvata", at: draft.created_at ?? null,
      href: appRoutes.rfqHub.savedDistinta(draft.id),
      campaignId: null, origin: "acquisti privati",
    });
  }

  // Stable ordering, with timeless historical items placed after dated records.
  items.sort((a, b) =>
    (b.at ? Date.parse(b.at) || 0 : 0) - (a.at ? Date.parse(a.at) || 0 : 0) ||
    a.key.localeCompare(b.key)
  );

  const procurementUnavailable = Boolean(campaigns.error || quotes.error || purchaseOrders.error || saved.error);
  return {
    items, inboundUnavailable, procurementUnavailable,
    partial: inboundUnavailable || procurementUnavailable || inbound?.mode === "demo",
    truncated: Boolean(
      (inbound?.mode === "live" && inbound.total > inbound.rows.length) ||
      (campaigns.data?.length === 60) || (quotes.data?.length === 40) ||
      (purchaseOrders.data?.length === 40) || (saved.data?.length === 40)
    ),
  };
}

export function filterCommercialItems(items: UnifiedCommercialItem[], view: CommercialView, query: string) {
  const needle = query.trim().toLocaleLowerCase("it-IT");
  return items.filter((item) =>
    (view === "all" || item.view === view) &&
    (!needle || [item.title, item.subtitle, item.status].some((text) => text.toLocaleLowerCase("it-IT").includes(needle)))
  );
}

export function commercialHref(view: CommercialView, query = "", selected?: string) {
  const params = new URLSearchParams();
  if (view !== "all") params.set("view", view);
  if (query.trim()) params.set("q", query.trim().slice(0, 80));
  if (selected) params.set("item", selected);
  const suffix = params.toString();
  return appRoutes.commercial.home + (suffix ? "?" + suffix : "") + "#commercial-worklist";
}
