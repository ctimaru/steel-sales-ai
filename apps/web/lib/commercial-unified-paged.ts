import "server-only";

import { getExplorerData } from "@/lib/commercial-data";
import {
  type CommercialView,
  type UnifiedCommercialData,
  type UnifiedCommercialItem,
} from "@/lib/commercial-unified-data";
import { rfqCampaignStatusLabel } from "@/lib/rfq-hub-overview";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

// The normalized inbound RPC currently pages 50 line-level records. Keep the
// native page size until the RPC supports a stable entity-level cursor.
export const COMMERCIAL_PAGE_SIZE = 30;
const INBOUND_PAGE_SIZE = 50;
export type CommercialPagedView = Extract<CommercialView, "received" | "sent" | "drafts">;

export function isCommercialPagedView(view: CommercialView): view is CommercialPagedView {
  return view === "received" || view === "sent" || view === "drafts";
}

export function parseCommercialPage(value: unknown): number {
  const raw = typeof value === "string" ? value : "";
  if (!/^[1-9]\d{0,2}$/.test(raw)) return 1;
  return Math.min(250, Number(raw));
}

// PostgREST ilike wildcards are not interpreted as search syntax. User input
// is an ordinary text fragment, not an arbitrary PostgREST filter expression.
function safeTitleSearch(input: string): string {
  return input.trim().replace(/[%,()_\\]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

type Paging = NonNullable<UnifiedCommercialData["paging"]>;

function basePaging(page: number, pageSize: number): Paging {
  return { page, pageSize, total: null, hasNext: false, exact: false };
}

function failure(view: CommercialPagedView, page: number, pageSize: number): UnifiedCommercialData {
  return {
    items: [],
    partial: true,
    inboundUnavailable: view === "received",
    procurementUnavailable: view !== "received",
    truncated: false,
    paging: basePaging(page, pageSize),
  };
}

export async function loadCommercialPagedData({
  organizationId, view, query, page,
}: {
  organizationId: string;
  view: CommercialPagedView;
  query: string;
  page: number;
}): Promise<UnifiedCommercialData> {
  // Inbound ownership and pagination live in the existing RLS/RPC contract;
  // do not load another tenant's data or substitute demo records.
  if (view === "received") {
    const inbound = await getExplorerData({
      organizationId,
      role: "requested",
      q: query,
      page,
    }).catch(() => null);
    if (!inbound || inbound.mode !== "live") return failure(view, page, INBOUND_PAGE_SIZE);

    const seen = new Set<string>();
    const items: UnifiedCommercialItem[] = [];
    for (const row of inbound.rows) {
      const href = row.operationalHref;
      const id = href?.split("/").at(-1);
      if (!isUuid(id) || !href || seen.has(id)) continue;
      seen.add(id);
      items.push({
        id, key: "inbound-rfq:" + id, kind: "inbound-rfq", view: "received",
        title: row.company || "Cliente non attribuito",
        subtitle: [row.product, row.standard, row.grade].filter(Boolean).join(" · "),
        status: "Richiesta nello storico",
        at: null, href, campaignId: null, origin: "memoria privata",
      });
    }

    return {
      items,
      partial: false, inboundUnavailable: false, procurementUnavailable: false,
      truncated: false,
      paging: {
        page,
        pageSize: INBOUND_PAGE_SIZE,
        total: inbound.total,
        hasNext: page * INBOUND_PAGE_SIZE < inbound.total,
        // The RPC pages commercial lines, not unique entity identifiers.
        exact: false,
      },
    };
  }

  const db = await createClient();
  const start = (page - 1) * COMMERCIAL_PAGE_SIZE;
  const rawQuery = safeTitleSearch(query);
  if (view === "sent") {
    let request = db.from("buyer_rfq_campaigns")
      .select("id,title,status,due_at,created_at", { count: "exact" })
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(start, start + COMMERCIAL_PAGE_SIZE - 1);
    if (rawQuery) request = request.ilike("title", "%" + rawQuery + "%");
    const result = await request;
    if (result.error) return failure(view, page, COMMERCIAL_PAGE_SIZE);
    return {
      items: (result.data ?? []).filter((record) => isUuid(record.id)).map((record) => ({
        id: record.id, key: "campaign:" + record.id, kind: "campaign" as const, view: "sent" as const,
        title: record.title?.trim() || "Richiesta ai fornitori",
        subtitle: record.due_at ? "Campagna · scadenza " + new Date(record.due_at).toLocaleDateString("it-IT") : "Campagna privata multi-fornitore",
        status: rfqCampaignStatusLabel(record.status),
        at: record.created_at,
        href: appRoutes.rfqHub.campaign(record.id),
        campaignId: record.id, origin: "acquisti privati" as const,
      })),
      partial: false, inboundUnavailable: false, procurementUnavailable: false, truncated: false,
      paging: {
        page, pageSize: COMMERCIAL_PAGE_SIZE, total: result.count ?? null,
        hasNext: result.count !== null ? (page * COMMERCIAL_PAGE_SIZE < result.count) :
          (result.data?.length === COMMERCIAL_PAGE_SIZE),
        exact: result.count !== null,
      },
    };
  }

  let request = db.from("buyer_distintas")
    .select("id,title,line_count,created_at", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, start + COMMERCIAL_PAGE_SIZE - 1);
  if (rawQuery) request = request.ilike("title", "%" + rawQuery + "%");
  const result = await request;
  if (result.error) return failure(view, page, COMMERCIAL_PAGE_SIZE);
  return {
    items: (result.data ?? []).filter((record) => isUuid(record.id)).map((record) => ({
      id: record.id, key: "distinta:" + record.id, kind: "distinta" as const, view: "drafts" as const,
      title: record.title?.trim() || "Distinta privata",
      subtitle: String(record.line_count ?? "—") + " righe · distinta salvata",
      status: "Salvata", at: record.created_at,
      href: appRoutes.rfqHub.savedDistinta(record.id),
      campaignId: null, origin: "acquisti privati" as const,
    })),
    partial: false, inboundUnavailable: false, procurementUnavailable: false, truncated: false,
    paging: {
      page, pageSize: COMMERCIAL_PAGE_SIZE, total: result.count ?? null,
      hasNext: result.count !== null ? (page * COMMERCIAL_PAGE_SIZE < result.count) :
        (result.data?.length === COMMERCIAL_PAGE_SIZE),
      exact: result.count !== null,
    },
  };
}

/**
 * DASH-NEXT1B: a Home priority can reference a campaign older than the first
 * 30 rows of the sent worklist. Resolve only that selected campaign with both
 * organization scoping and RLS, instead of sending users to the legacy Hub.
 * Never return a campaign from another tenant or infer its status.
 */
export async function includeSelectedCommercialCampaign(
  organizationId: string,
  selected: string,
  data: UnifiedCommercialData,
): Promise<UnifiedCommercialData> {
  const match = /^campaign:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(selected);
  if (!match || data.items.some((item) => item.key === selected)) return data;

  const db = await createClient();
  const result = await db.from("buyer_rfq_campaigns")
    .select("id,title,status,due_at,created_at")
    .eq("organization_id", organizationId)
    .eq("id", match[1])
    .maybeSingle();

  // An unowned/nonexistent campaign is indistinguishable to the caller.
  if (result.error || !result.data || !isUuid(result.data.id)) return data;
  const campaign = result.data;
  return {
    ...data,
    items: [{
      id: campaign.id,
      key: "campaign:" + campaign.id,
      kind: "campaign", view: "sent",
      title: campaign.title?.trim() || "Richiesta ai fornitori",
      subtitle: campaign.due_at
        ? "Campagna · scadenza " + new Date(campaign.due_at).toLocaleDateString("it-IT")
        : "Campagna privata multi-fornitore",
      status: rfqCampaignStatusLabel(campaign.status),
      at: campaign.created_at,
      href: appRoutes.rfqHub.campaign(campaign.id),
      campaignId: campaign.id,
      origin: "acquisti privati",
    }, ...data.items],
  };
}
