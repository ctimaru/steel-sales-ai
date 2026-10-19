import "server-only";

import {
  type CommercialView,
  type UnifiedCommercialData,
  type UnifiedCommercialItem,
} from "@/lib/commercial-unified-data";
import { rfqCampaignStatusLabel } from "@/lib/rfq-hub-overview";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

// The same bounded window is used for saved drafts, buyer RFQs and real
// inbound customer RFQ entities. No line-level count may masquerade as a total.
export const COMMERCIAL_PAGE_SIZE = 30;
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
  // Entity-level read: each request has one ID and one count, even when it
  // contains many tube lines. SQL SECURITY INVOKER + tenant membership + RLS.
  if (view === "received") {
    const db = await createClient();
    const { data, error } = await db.rpc("commercial_unify_entity_search_v1", {
      p_organization_id: organizationId,
      p_source: "rfqs",
      p_query: query,
      p_limit: COMMERCIAL_PAGE_SIZE,
      p_offset: (page - 1) * COMMERCIAL_PAGE_SIZE,
    });
    if (error || !data || typeof data !== "object" || Array.isArray(data))
      return failure(view, page, COMMERCIAL_PAGE_SIZE);
    const payload = data as { error?: unknown; total?: unknown; rows?: unknown };
    if (payload.error || !Number.isSafeInteger(payload.total) ||
      Number(payload.total) < 0 || !Array.isArray(payload.rows))
      return failure(view, page, COMMERCIAL_PAGE_SIZE);
    type EntityRow = { id?: unknown; company_name?: unknown; product_preview?: unknown;
      status?: unknown; created_at?: unknown };
    const rows = payload.rows as EntityRow[];
    const items: UnifiedCommercialItem[] = rows.filter((row) => isUuid(row.id)).map((row) => {
      const id = row.id as string;
      const company = typeof row.company_name === "string" && row.company_name.trim()
        ? row.company_name.trim() : "Cliente non attribuito";
      const product = typeof row.product_preview === "string"
        ? row.product_preview.trim().slice(0, 140) : "";
      return {
        id, key: "inbound-rfq:" + id, kind: "inbound-rfq", view: "received",
        title: company, subtitle: product || "Richiesta commerciale ricevuta",
        status: typeof row.status === "string" ? row.status : "Richiesta nello storico",
        at: typeof row.created_at === "string" ? row.created_at : null,
        href: appRoutes.commercial.rfq(id), campaignId: null,
        origin: "memoria privata",
      };
    });
    const total = Number(payload.total);
    return {
      items, partial: false, inboundUnavailable: false, procurementUnavailable: false,
      truncated: false,
      paging: {
        page, pageSize: COMMERCIAL_PAGE_SIZE, total,
        hasNext: page * COMMERCIAL_PAGE_SIZE < total,
        exact: true,
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
