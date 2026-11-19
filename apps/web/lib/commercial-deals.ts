import "server-only";

import {
  distintaDealsFromRows, pageFromDeals, parseDealIndex, purchaseDealsFromRows, resolveDealKey, salesDealsFromRows,
  type CommercialDeal, type DealCounts, type DealDeskState, type DealIndexKey, type DealRoutes,
} from "@/lib/commercial-deal-model";
import { ROW_LINES_FETCHED } from "@/lib/commercial-row-lines";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

// Lettura delle trattative per la lista Commerciale.
//
// COMM-DEALS2: la priorità «cosa fare adesso», i filtri, la ricerca e i
// conteggi sono calcolati su TUTTE le trattative dell'azienda da
// public.comm_deals2_index (SQL, SECURITY INVOKER, quindi RLS). La funzione
// restituisce solo le chiavi della pagina; qui si leggono le righe complete di
// quelle trattative e il modello le trasforma in righe della lista.
//
// Ripiego COMM-DEALS1: se la funzione non risponde, la lista resta disponibile
// sulla finestra delle 200 trattative più recenti per lato.
//
// Letture autorizzate: nessun testo delle email, nessuna nota, nessun prezzo.

export const DEALS_WINDOW = 200;
const ORPHANS_WINDOW = 100;

export type CommercialDealsPage = {
  rows: CommercialDeal[];
  /** Trattativa aperta nel dettaglio, anche se non è nella pagina mostrata. */
  selected: CommercialDeal | null;
  total: number;
  page: number;
  pages: number;
  counts: DealCounts;
  salesUnavailable: boolean;
  purchaseUnavailable: boolean;
  /** Solo nel ripiego: almeno un lato ha riempito la finestra. */
  truncated: boolean;
  source: "index" | "window";
};

const routes: DealRoutes = {
  rfq: appRoutes.commercial.rfq,
  offer: appRoutes.commercial.offer,
  order: appRoutes.commercial.order,
  campaign: appRoutes.rfqHub.campaign,
  distinta: appRoutes.rfqHub.savedDistinta,
};

const OFFER_FIELDS = "id,status,created_at,deal_label";
const ORDER_FIELDS = "id,status,created_at,customer_order_ref";
const LINE_FIELDS = "requested_quantity,quantity_unit,requested_standard,requested_grade,created_at";
const COMPANY = (fk: string) => "company:companies!" + fk + "(name)";

// Select dinamiche (tipo `string`): stesso tipo di risultato per lettura completa e di riserva.
const SALES_SELECT: string = "id,status,created_at,due_at,deal_label," + COMPANY("rfqs_company_id_fkey") + "," +
  "lines:rfq_lines!rfq_lines_rfq_id_fkey(" + LINE_FIELDS + ")," +
  "offers:offers!offers_rfq_id_fkey(" + OFFER_FIELDS + ")," +
  "orders:orders!orders_rfq_id_fkey(" + ORDER_FIELDS + ")";
const SALES_SELECT_BARE: string = "id,status,created_at,due_at,deal_label," + COMPANY("rfqs_company_id_fkey") + "," +
  "offers:offers!offers_rfq_id_fkey(" + OFFER_FIELDS + "),orders:orders!orders_rfq_id_fkey(" + ORDER_FIELDS + ")";
const ORPHAN_OFFER_SELECT: string = OFFER_FIELDS + "," + COMPANY("offers_company_id_fkey") +
  ",orders:orders!orders_offer_id_fkey(" + ORDER_FIELDS + ")";
const ORPHAN_ORDER_SELECT: string = ORDER_FIELDS + ",deal_label," + COMPANY("orders_company_id_fkey");
const CAMPAIGN_SELECT: string = "id,title,status,due_at,created_at,source_distinta_id," +
  "distinta:buyer_distintas!buyer_rfq_campaigns_source_distinta_id_fkey(line_count,total_tonnes,total_meters)," +
  "suppliers:buyer_rfq_suppliers!buyer_rfq_suppliers_rfq_id_fkey(status)," +
  "quotes:buyer_rfq_quotes!buyer_rfq_quotes_rfq_id_fkey(id,supplier_id,status,submitted_at,created_at)," +
  "orders:buyer_purchase_order_drafts!buyer_purchase_order_drafts_rfq_id_fkey(id,status,po_draft_ref,supplier_name_snapshot,created_at)";
const CAMPAIGN_SELECT_BARE: string = "id,title,status,due_at,created_at,source_distinta_id";
const DISTINTA_SELECT: string = "id,title,line_count,total_tonnes,total_meters,created_at";

type Db = Awaited<ReturnType<typeof createClient>>;
type Ids = { rfqs: string[]; offers: string[]; orders: string[]; campaigns: string[]; distinte: string[] };

// ── Righe complete per un insieme di chiavi (fase 2) ──────────────────────────

async function salesByIds(db: Db, organizationId: string, ids: string[]) {
  if (!ids.length) return { data: [] as unknown[], error: false };
  let result = await db.from("rfqs").select(SALES_SELECT)
    .eq("organization_id", organizationId).in("id", ids)
    .order("created_at", { referencedTable: "lines", ascending: true })
    .limit(ROW_LINES_FETCHED, { referencedTable: "lines" });
  // Le righe articolo sono un arricchimento: senza, la trattativa resta visibile.
  if (result.error) result = await db.from("rfqs").select(SALES_SELECT_BARE).eq("organization_id", organizationId).in("id", ids);
  return { data: (result.data ?? []) as unknown[], error: Boolean(result.error) };
}

async function campaignsByIds(db: Db, organizationId: string, ids: string[]) {
  if (!ids.length) return { data: [] as unknown[], error: false };
  let result = await db.from("buyer_rfq_campaigns").select(CAMPAIGN_SELECT).eq("organization_id", organizationId).in("id", ids);
  if (result.error) result = await db.from("buyer_rfq_campaigns").select(CAMPAIGN_SELECT_BARE).eq("organization_id", organizationId).in("id", ids);
  return { data: (result.data ?? []) as unknown[], error: Boolean(result.error) };
}

async function simpleByIds(db: Db, table: "offers" | "orders" | "buyer_distintas", select: string, organizationId: string, ids: string[]) {
  if (!ids.length) return { data: [] as unknown[], error: false };
  const result = await db.from(table).select(select).eq("organization_id", organizationId).in("id", ids);
  return { data: (result.data ?? []) as unknown[], error: Boolean(result.error) };
}

async function dealsByIds(db: Db, organizationId: string, ids: Ids) {
  const [rfqs, offers, orders, campaigns, distinte] = await Promise.all([
    salesByIds(db, organizationId, ids.rfqs),
    simpleByIds(db, "offers", ORPHAN_OFFER_SELECT, organizationId, ids.offers),
    simpleByIds(db, "orders", ORPHAN_ORDER_SELECT, organizationId, ids.orders),
    campaignsByIds(db, organizationId, ids.campaigns),
    simpleByIds(db, "buyer_distintas", DISTINTA_SELECT, organizationId, ids.distinte),
  ]);
  return {
    // L'indice ha già scartato le distinte usate da una RFQ.
    deals: [
      ...salesDealsFromRows(rfqs.data, offers.data, orders.data, routes),
      ...purchaseDealsFromRows(campaigns.data, routes),
      ...distintaDealsFromRows(distinte.data, new Set(), routes),
    ],
    salesUnavailable: rfqs.error || offers.error || orders.error,
    purchaseUnavailable: campaigns.error || distinte.error,
  };
}

function idsOf(keys: readonly DealIndexKey[]): Ids {
  const ids: Ids = { rfqs: [], offers: [], orders: [], campaigns: [], distinte: [] };
  for (const { kind, id } of keys) {
    if (kind === "inbound-rfq") ids.rfqs.push(id);
    else if (kind === "inbound-offer") ids.offers.push(id);
    else if (kind === "inbound-order") ids.orders.push(id);
    else if (kind === "campaign") ids.campaigns.push(id);
    else ids.distinte.push(id);
  }
  return ids;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Trattativa di un link ?item= (anche di un documento figlio: offerta, ordine,
 * risposta fornitore, PO). Sempre filtrata per azienda e RLS: una chiave di
 * un'altra azienda non trova nulla.
 */
async function dealKeyFor(db: Db, organizationId: string, key: string): Promise<DealIndexKey | null> {
  const [prefix, id] = key.split(":");
  if (!id || !UUID.test(id)) return null;
  if (prefix === "inbound-rfq" || prefix === "campaign" || prefix === "distinta") {
    return { key: prefix + ":" + id, kind: prefix, id };
  }
  if (prefix === "quote" || prefix === "purchase-order") {
    const table = prefix === "quote" ? "buyer_rfq_quotes" : "buyer_purchase_order_drafts";
    const { data } = await db.from(table).select("rfq_id").eq("organization_id", organizationId).eq("id", id).maybeSingle();
    const rfqId = (data as { rfq_id?: unknown } | null)?.rfq_id;
    return typeof rfqId === "string" && UUID.test(rfqId) ? { key: "campaign:" + rfqId, kind: "campaign", id: rfqId } : null;
  }
  if (prefix === "inbound-offer") {
    const { data } = await db.from("offers").select("id,rfq_id").eq("organization_id", organizationId).eq("id", id).maybeSingle();
    const row = data as { rfq_id?: unknown } | null;
    if (!row) return null;
    return typeof row.rfq_id === "string" && UUID.test(row.rfq_id)
      ? { key: "inbound-rfq:" + row.rfq_id, kind: "inbound-rfq", id: row.rfq_id }
      : { key: "inbound-offer:" + id, kind: "inbound-offer", id };
  }
  if (prefix === "inbound-order") {
    const { data } = await db.from("orders").select("id,rfq_id,offer_id").eq("organization_id", organizationId).eq("id", id).maybeSingle();
    const row = data as { rfq_id?: unknown; offer_id?: unknown } | null;
    if (!row) return null;
    if (typeof row.rfq_id === "string" && UUID.test(row.rfq_id)) return { key: "inbound-rfq:" + row.rfq_id, kind: "inbound-rfq", id: row.rfq_id };
    if (typeof row.offer_id === "string" && UUID.test(row.offer_id)) return dealKeyFor(db, organizationId, "inbound-offer:" + row.offer_id);
    return { key: "inbound-order:" + id, kind: "inbound-order", id };
  }
  return null;
}

async function loadFromIndex(db: Db, organizationId: string, state: DealDeskState, pageSize: number): Promise<CommercialDealsPage | null> {
  const offset = (state.page - 1) * pageSize;
  const { data, error } = await db.rpc("comm_deals2_index", {
    p_organization_id: organizationId, p_segment: state.segment, p_filter: state.filter,
    p_query: state.query, p_limit: pageSize, p_offset: offset,
  });
  if (error) return null;
  let index = parseDealIndex(data);
  if (!index) return null;
  const pages = Math.max(1, Math.ceil(index.total / pageSize));
  let page = state.page;
  // Pagina oltre la fine (ad es. dopo aver chiuso trattative): si torna all'ultima.
  if (page > pages) {
    page = pages;
    const retry = await db.rpc("comm_deals2_index", {
      p_organization_id: organizationId, p_segment: state.segment, p_filter: state.filter,
      p_query: state.query, p_limit: pageSize, p_offset: (page - 1) * pageSize,
    });
    index = retry.error ? null : parseDealIndex(retry.data);
    if (!index) return null;
  }

  const wanted = state.item ? await dealKeyFor(db, organizationId, state.item).catch(() => null) : null;
  const keys = [...index.keys];
  if (wanted && !keys.some((k) => k.key === wanted.key)) keys.push(wanted);
  const loaded = await dealsByIds(db, organizationId, idsOf(keys));
  const byKey = new Map(loaded.deals.map((deal) => [deal.key, deal]));
  return {
    // L'ordine è quello dell'indice; una riga non più leggibile viene saltata.
    rows: index.keys.map((k) => byKey.get(k.key)).filter((deal): deal is CommercialDeal => Boolean(deal)),
    selected: wanted ? byKey.get(wanted.key) ?? null : null,
    total: index.total, page, pages,
    counts: index.counts,
    salesUnavailable: loaded.salesUnavailable,
    purchaseUnavailable: loaded.purchaseUnavailable,
    truncated: false,
    source: "index",
  };
}

// ── Ripiego COMM-DEALS1: finestra delle trattative più recenti ───────────────

async function loadSalesWindow(db: Db, organizationId: string) {
  let rfqs = await db.from("rfqs").select(SALES_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .order("created_at", { referencedTable: "lines", ascending: true })
    .limit(ROW_LINES_FETCHED, { referencedTable: "lines" })
    .limit(DEALS_WINDOW);
  if (rfqs.error) {
    rfqs = await db.from("rfqs").select(SALES_SELECT_BARE)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(DEALS_WINDOW);
  }
  const [offers, orders] = await Promise.all([
    db.from("offers").select(ORPHAN_OFFER_SELECT)
      .eq("organization_id", organizationId).is("rfq_id", null)
      .order("created_at", { ascending: false }).limit(ORPHANS_WINDOW),
    db.from("orders").select(ORPHAN_ORDER_SELECT)
      .eq("organization_id", organizationId).is("rfq_id", null).is("offer_id", null)
      .order("created_at", { ascending: false }).limit(ORPHANS_WINDOW),
  ]);
  return {
    deals: rfqs.error ? [] : salesDealsFromRows(rfqs.data, offers.error ? [] : offers.data, orders.error ? [] : orders.data, routes),
    unavailable: Boolean(rfqs.error),
    full: (rfqs.data?.length ?? 0) >= DEALS_WINDOW,
  };
}

async function loadPurchaseWindow(db: Db, organizationId: string) {
  let campaigns = await db.from("buyer_rfq_campaigns").select(CAMPAIGN_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(DEALS_WINDOW);
  if (campaigns.error) {
    campaigns = await db.from("buyer_rfq_campaigns").select(CAMPAIGN_SELECT_BARE)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(DEALS_WINDOW);
  }
  const distinte = await db.from("buyer_distintas").select(DISTINTA_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false }).limit(ORPHANS_WINDOW);
  // Una distinta già usata da una RFQ (anche fuori finestra) non è una bozza.
  const distintaRows = (distinte.data ?? []) as Array<{ id?: unknown }>;
  const distintaIds = distintaRows.map((row) => row.id).filter((id): id is string => typeof id === "string");
  const used = new Set<string>();
  for (const row of (campaigns.data ?? []) as Array<{ source_distinta_id?: unknown }>) {
    if (typeof row.source_distinta_id === "string") used.add(row.source_distinta_id);
  }
  const unknown = distintaIds.filter((id) => !used.has(id));
  let usedUnknown = false;
  if (unknown.length) {
    const linked = await db.from("buyer_rfq_campaigns").select("source_distinta_id")
      .eq("organization_id", organizationId).in("source_distinta_id", unknown);
    if (linked.error) usedUnknown = true;
    for (const row of linked.data ?? []) if (typeof row.source_distinta_id === "string") used.add(row.source_distinta_id);
  }
  return {
    deals: [
      ...(campaigns.error ? [] : purchaseDealsFromRows(campaigns.data, routes)),
      // Senza poter verificare i collegamenti, meglio nessuna bozza che una bozza sbagliata.
      ...(distinte.error || usedUnknown ? [] : distintaDealsFromRows(distinte.data, used, routes)),
    ],
    unavailable: Boolean(campaigns.error),
    full: (campaigns.data?.length ?? 0) >= DEALS_WINDOW,
  };
}

async function loadFromWindow(db: Db, organizationId: string, state: DealDeskState, pageSize: number): Promise<CommercialDealsPage> {
  // COMM-CLIENTS1: Richieste d'offerta reads the sales side only.
  const skip = { deals: [] as CommercialDeal[], unavailable: false, full: false };
  const [sales, purchase] = await Promise.all([
    state.segment === "purchase" ? skip : loadSalesWindow(db, organizationId).catch(() => ({ deals: [], unavailable: true, full: false })),
    state.segment === "sales" ? skip : loadPurchaseWindow(db, organizationId).catch(() => ({ deals: [], unavailable: true, full: false })),
  ]);
  const deals = [...sales.deals, ...purchase.deals];
  const view = pageFromDeals(deals, state, pageSize);
  const selectedKey = resolveDealKey(deals, state.item);
  return {
    ...view,
    selected: selectedKey ? deals.find((deal) => deal.key === selectedKey) ?? null : null,
    salesUnavailable: sales.unavailable,
    purchaseUnavailable: purchase.unavailable,
    truncated: sales.full || purchase.full,
    source: "window",
  };
}

/**
 * COMM-CLIENTS1: purchase deals live in Centro RFQ. An old link to a purchase
 * deal or document on /commercial (?item=campaign:…, quote:…, purchase-order:…,
 * distinta:…) returns the page that now holds it; null for anything else.
 * The lookup is filtered by organization and RLS like every other read.
 */
export async function purchaseItemHref(organizationId: string, item: string): Promise<string | null> {
  const prefix = item.split(":")[0];
  if (!["campaign", "quote", "purchase-order", "distinta"].includes(prefix)) return null;
  const db = await createClient();
  const key = await dealKeyFor(db, organizationId, item).catch(() => null);
  if (key?.kind === "campaign") return routes.campaign(key.id);
  if (key?.kind === "distinta") return routes.distinta(key.id);
  return appRoutes.rfqHub.home;
}

export async function loadCommercialDealsPage(organizationId: string, state: DealDeskState, pageSize: number): Promise<CommercialDealsPage> {
  const db = await createClient();
  const indexed = await loadFromIndex(db, organizationId, state, pageSize).catch(() => null);
  return indexed ?? loadFromWindow(db, organizationId, state, pageSize);
}

export type DealLine = { id: string; position: number; description: string; spec: string; quantity: string };

/** Righe articolo del dettaglio: norma, grado e quantità. Nessun prezzo. */
export async function loadDealLines(deal: CommercialDeal): Promise<DealLine[] | null> {
  const db = await createClient();
  const fmt = (value: unknown, unit: string) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(n) + (unit ? " " + unit : "") : "";
  };
  if (deal.kind === "inbound-rfq") {
    const result = await db.from("rfq_lines")
      .select("id,requested_quantity,quantity_unit,requested_standard,requested_grade,created_at")
      .eq("rfq_id", deal.id).order("created_at", { ascending: true }).limit(50);
    if (result.error) return null;
    return (result.data ?? []).map((line, index) => ({
      id: String(line.id), position: index + 1, description: "",
      spec: [line.requested_standard, line.requested_grade].filter(Boolean).join(" · "),
      quantity: fmt(line.requested_quantity, typeof line.quantity_unit === "string" ? line.quantity_unit : ""),
    }));
  }
  if (deal.distintaId) {
    const result = await db.from("buyer_distinta_lines")
      .select("id,line_position,description,standard_code,grade_code,line_tonnes,line_meters")
      .eq("distinta_id", deal.distintaId).order("line_position", { ascending: true }).limit(50);
    if (result.error) return null;
    return (result.data ?? []).map((line) => ({
      id: String(line.id), position: Number(line.line_position) || 0,
      description: typeof line.description === "string" ? line.description.slice(0, 140) : "",
      spec: [line.standard_code, line.grade_code].filter(Boolean).join(" · "),
      quantity: fmt(line.line_tonnes, "t") || fmt(line.line_meters, "m"),
    }));
  }
  return [];
}
