import "server-only";

import { Buffer } from "node:buffer";

import {
  type CommercialView,
  type UnifiedCommercialData,
  type UnifiedCommercialItem,
} from "@/lib/commercial-unified-data";
import { rfqCampaignStatusLabel, rfqOrderStatusLabel } from "@/lib/rfq-hub-overview";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const STREAM_PAGE_SIZE = 30;
const FETCH_PER_STREAM = STREAM_PAGE_SIZE + 1;
const MAX_HISTORY = 60;
type StreamId = "rfqs" | "offers" | "orders" | "campaigns" | "quotes" | "purchaseOrders" | "drafts";
type StreamView = Extract<CommercialView, "all" | "offers" | "orders">;
type Offsets = Record<StreamId, number>;
const ids: readonly StreamId[] = ["rfqs", "offers", "orders", "campaigns", "quotes", "purchaseOrders", "drafts"];
const streams: Record<StreamView, readonly StreamId[]> = {
  all: ids,
  offers: ["offers", "quotes"],
  orders: ["orders", "purchaseOrders"],
};
const zero = (): Offsets => ({
  rfqs: 0, offers: 0, orders: 0, campaigns: 0, quotes: 0, purchaseOrders: 0, drafts: 0,
});
type State = { v: 1; view: StreamView; query: string; page: number; offsets: Offsets; history: Offsets[] };

const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function isStreamView(view: CommercialView): view is StreamView {
  return view === "all" || view === "offers" || view === "orders";
}

function validOffsets(value: unknown): value is Offsets {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return ids.every((id) =>
    Number.isSafeInteger((value as Record<string, unknown>)[id]) &&
    Number((value as Record<string, unknown>)[id]) >= 0 &&
    Number((value as Record<string, unknown>)[id]) <= 100_000
  );
}

// This cursor is navigation state, NOT authorization. Supabase RLS always
// independently enforces tenant and user-level read permissions.
function encode(state: State): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}
function decode(value: string | undefined, view: StreamView, query: string): State {
  const first: State = { v: 1, view, query, page: 1, offsets: zero(), history: [] };
  if (!value || value.length > 16000) return first;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return first;
    const candidate = parsed as Partial<State>;
    if (
      candidate.v !== 1 || candidate.view !== view || candidate.query !== query ||
      !Number.isSafeInteger(candidate.page) || !candidate.page ||
      candidate.page < 1 || candidate.page > MAX_HISTORY ||
      !validOffsets(candidate.offsets) ||
      !Array.isArray(candidate.history) ||
      candidate.history.length !== candidate.page - 1 ||
      candidate.history.length >= MAX_HISTORY ||
      !candidate.history.every(validOffsets)
    ) return first;
    return candidate as State;
  } catch {
    return first;
  }
}
export function mergedCommercialHref(view: StreamView, query: string, cursor?: string, selected?: string) {
  const params = new URLSearchParams();
  if (view !== "all") params.set("view", view);
  if (query.trim()) params.set("q", query.trim().slice(0, 80));
  if (cursor) params.set("cursor", cursor);
  if (selected) params.set("item", selected);
  const suffix = params.toString();
  return appRoutes.commercial.home + (suffix ? "?" + suffix : "") + "#commercial-worklist";
}

// No dynamic PostgREST expression can be injected from a typed search term.
function safeQuery(input: string) {
  return input.trim().replace(/[%_(),\\"\\]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}
type Loaded = { id: StreamId; rows: UnifiedCommercialItem[]; total: number | null; error: boolean };
type Row = Record<string, unknown>;
const str = (value: unknown, defaultValue: string) =>
  typeof value === "string" && value.trim() ? value.trim() : defaultValue;
const text = (value: unknown) => typeof value === "string" ? value : null;
const name = (value: unknown) => {
  const parent = Array.isArray(value) ? value[0] : value;
  return parent && typeof parent === "object" ? text((parent as Row).name) : null;
};
const title = (value: unknown) => {
  const parent = Array.isArray(value) ? value[0] : value;
  return parent && typeof parent === "object" ? text((parent as Row).title) : null;
};
const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
const normalizedTime = (value: unknown) => timestamp(value) ?? "1970-01-01T00:00:00Z";

function mapSource(source: StreamId, rows: Row[]): UnifiedCommercialItem[] {
  return rows.filter((r) => uuid(r.id)).map((r) => {
    const id = r.id as string;
    const kind: UnifiedCommercialItem["kind"] = source === "rfqs" ? "inbound-rfq" :
      source === "offers" ? "inbound-offer" : source === "orders" ? "inbound-order" :
      source === "campaigns" ? "campaign" : source === "quotes" ? "quote" :
      source === "purchaseOrders" ? "purchase-order" : "distinta";
    const view: UnifiedCommercialItem["view"] = source === "rfqs" ? "received" :
      source === "campaigns" ? "sent" : source === "drafts" ? "drafts" :
      source === "offers" || source === "quotes" ? "offers" : "orders";
    const campaignId = uuid(r.rfq_id) && (source === "quotes" || source === "purchaseOrders") ? r.rfq_id :
      source === "campaigns" ? id : null;
    const campaignTitle = title(r.campaign);
    const customer = name(r.company);
    const headline = source === "rfqs" ? str(customer, "Richiesta cliente") :
      source === "offers" ? str(customer, "Offerta commerciale") :
      source === "orders" ? str(customer, "Ordine cliente") :
      source === "campaigns" ? str(r.title, "Richiesta ai fornitori") :
      source === "quotes" ? str(campaignTitle, "Offerta fornitore") :
      source === "purchaseOrders" ? str(r.po_draft_ref, "Ordine acquisti") :
      str(r.title, "Distinta privata");
    const status = source === "campaigns" ? rfqCampaignStatusLabel(str(r.status, "")) :
      source === "purchaseOrders" ? rfqOrderStatusLabel(str(r.status, "")) :
      source === "quotes" ? "Offerta ricevuta" :
      source === "drafts" ? "Salvata" : str(r.status, "—");
    const subtitle = source === "quotes" ? "Risposta fornitore · revisione " + String(r.revision_no ?? "—") :
      source === "purchaseOrders" ? str(r.supplier_name_snapshot, str(campaignTitle, "Fornitore")) :
      source === "drafts" ? String(r.line_count ?? "—") + " righe · distinta privata" :
      source === "campaigns" ? "Campagna privata ai fornitori" :
      source === "rfqs" ? "Richiesta commerciale ricevuta" :
      source === "offers" ? "Offerta commerciale inviata" : "Ordine cliente";
    const href = source === "rfqs" ? appRoutes.commercial.rfq(id) :
      source === "offers" ? appRoutes.commercial.offer(id) :
      source === "orders" ? appRoutes.commercial.order(id) :
      source === "drafts" ? appRoutes.rfqHub.savedDistinta(id) :
      appRoutes.rfqHub.campaign(campaignId ?? id);
    const at = timestamp(r.created_at);
    return {
      id, key: kind + ":" + id, kind, view, title: headline, subtitle, status, at,
      href, campaignId, origin: source === "rfqs" || source === "offers" || source === "orders" ?
        "memoria privata" as const : "acquisti privati" as const,
    };
  });
}

// Read-only per-source queries use PostgREST's row-level security, stable
// created_at/id ordering, fixed 31-row windows, and independent exact counts.
async function fetchSource(
  db: Awaited<ReturnType<typeof createClient>>,
  source: StreamId,
  organizationId: string,
  q: string,
  offset: number,
): Promise<Loaded> {
  const from = offset, to = offset + FETCH_PER_STREAM - 1;
  // Authored select strings avoid dynamic SQL and never include private quote prices.
  let request;
  if (source === "rfqs") {
    request = db.from("rfqs")
      .select("id,status,created_at,company:companies!rfqs_company_id_fkey(name)", { count: "exact" })
      .eq("organization_id", organizationId).order("created_at", { ascending: false })
      .order("id", { ascending: false }).range(from, to);
    if (q) request = request.ilike("status", "%" + q + "%");
  } else if (source === "offers") {
    request = db.from("offers")
      .select("id,status,created_at,company:companies!offers_company_id_fkey(name)", { count: "exact" })
      .eq("organization_id", organizationId).order("created_at", { ascending: false })
      .order("id", { ascending: false }).range(from, to);
    if (q) request = request.ilike("status", "%" + q + "%");
  } else if (source === "orders") {
    request = db.from("orders")
      .select("id,status,created_at,company:companies!orders_company_id_fkey(name)", { count: "exact" })
      .eq("organization_id", organizationId).order("created_at", { ascending: false })
      .order("id", { ascending: false }).range(from, to);
    if (q) request = request.ilike("status", "%" + q + "%");
  } else if (source === "campaigns") {
    request = db.from("buyer_rfq_campaigns")
      .select("id,title,status,created_at", { count: "exact" })
      .eq("organization_id", organizationId).order("created_at", { ascending: false })
      .order("id", { ascending: false }).range(from, to);
    if (q) request = request.or("title.ilike.%" + q + "%,status.ilike.%" + q + "%");
  } else if (source === "quotes") {
    request = db.from("buyer_rfq_quotes")
      .select("id,rfq_id,revision_no,status,created_at,campaign:buyer_rfq_campaigns!buyer_rfq_quotes_rfq_id_fkey!inner(title)", { count: "exact" })
      .eq("organization_id", organizationId).eq("status", "submitted")
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(from, to);
    if (q) request = request.ilike("campaign.title", "%" + q + "%");
  } else if (source === "purchaseOrders") {
    request = db.from("buyer_purchase_order_drafts")
      .select("id,rfq_id,po_draft_ref,status,supplier_name_snapshot,created_at,campaign:buyer_rfq_campaigns!buyer_purchase_order_drafts_rfq_id_fkey!inner(title)", { count: "exact" })
      .eq("organization_id", organizationId).order("created_at", { ascending: false })
      .order("id", { ascending: false }).range(from, to);
    if (q) request = request.or("po_draft_ref.ilike.%" + q + "%,supplier_name_snapshot.ilike.%" + q + "%");
  } else {
    request = db.from("buyer_distintas")
      .select("id,title,line_count,created_at", { count: "exact" })
      .eq("organization_id", organizationId).order("created_at", { ascending: false })
      .order("id", { ascending: false }).range(from, to);
    if (q) request = request.ilike("title", "%" + q + "%");
  }
  const result = await request;
  if (result.error) return { id: source, rows: [], total: null, error: true };
  const data = (result.data ?? []) as Row[];
  return { id: source, rows: mapSource(source, data), total: result.count ?? null, error: false };
}

// Deterministic k-way merge: each source returns only 31 rows, and we advance
// its cursor by precisely the number consumed in the global first 30.
export async function loadCommercialStreams({
  organizationId, view, query, cursor,
}: {
  organizationId: string;
  view: StreamView;
  query: string;
  cursor?: string;
}): Promise<UnifiedCommercialData> {
  const clean = safeQuery(query);
  const state = decode(cursor, view, clean);
  const db = await createClient();
  const selectedStreams = streams[view];
  const batches = await Promise.all(selectedStreams.map((source) =>
    fetchSource(db, source, organizationId, clean, state.offsets[source])
      .catch((): Loaded => ({ id: source, rows: [], total: null, error: true }))
  ));
  const failures = batches.some((batch) => batch.error);
  // Fail-closed: a missing source must never cause an apparently complete page,
  // an incorrect total or an opaque cursor that skips records.
  if (failures) {
    return {
      items: [], partial: true,
      inboundUnavailable: batches.some((x) => x.error && ["rfqs", "offers", "orders"].includes(x.id)),
      procurementUnavailable: batches.some((x) => x.error && !["rfqs", "offers", "orders"].includes(x.id)),
      truncated: false,
      paging: { page: state.page, pageSize: STREAM_PAGE_SIZE, total: null, exact: false, hasNext: false },
    };
  }

  const flat = batches.flatMap((batch) => batch.rows.map((item, index) => ({ item, source: batch.id, index })));
  const ordered = flat.sort((a, b) =>
    normalizedTime(b.item.at).localeCompare(normalizedTime(a.item.at)) ||
    // Preserve the database id-DESC order inside each stream on equal dates,
    // otherwise an offset cursor could skip/duplicate simultaneous records.
    (a.source === b.source ? a.index - b.index : a.source.localeCompare(b.source)) ||
    a.item.key.localeCompare(b.item.key)
  );
  const firstPage = ordered.slice(0, STREAM_PAGE_SIZE);
  const nextOffsets = { ...state.offsets };
  for (const row of firstPage) nextOffsets[row.source]++;
  const total = batches.every((x) => x.total !== null)
    ? batches.reduce((sum, x) => sum + (x.total ?? 0), 0) : null;
  const consumed = selectedStreams.reduce((sum, id) => sum + nextOffsets[id], 0);
  const hasNext = total === null ? ordered.length > STREAM_PAGE_SIZE : consumed < total;
  const canAdvance = state.page < MAX_HISTORY;
  const nextCursor = hasNext && canAdvance ? encode({
    ...state, page: state.page + 1, offsets: nextOffsets,
    history: [...state.history, state.offsets],
  }) : null;
  const prevCursor = state.page > 1 ? encode({
    ...state, page: state.page - 1,
    offsets: state.history[state.history.length - 1],
    history: state.history.slice(0, -1),
  }) : null;
  return {
    items: firstPage.map((x) => x.item), partial: false,
    inboundUnavailable: false, procurementUnavailable: false,
    truncated: Boolean(hasNext && !canAdvance),
    paging: {
      page: state.page, pageSize: STREAM_PAGE_SIZE, total,
      exact: total !== null, hasNext: Boolean(nextCursor),
      currentCursor: state.page > 1 ? encode(state) : null,
      nextCursor,
      previousCursor: prevCursor,
    },
  };
}
