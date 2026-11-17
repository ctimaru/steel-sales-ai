import "server-only";

import {
  distintaDealsFromRows, purchaseDealsFromRows, salesDealsFromRows,
  type CommercialDeal, type DealRoutes,
} from "@/lib/commercial-deal-model";
import { ROW_LINES_FETCHED } from "@/lib/commercial-row-lines";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

// COMM-DEALS1 — lettura delle trattative per la lista Commerciale.
//
// Finestra limitata: le 200 richieste cliente e le 200 RFQ ai fornitori più
// recenti, ciascuna con i propri documenti incorporati nella stessa query
// (PostgREST + RLS). La priorità «cosa fare adesso» è calcolata su tutta la
// finestra, non sulla singola pagina. Oltre la finestra si usa la ricerca
// nello storico; la fase successiva porterà la priorità in una funzione SQL.
//
// Letture autorizzate: nessun testo delle email, nessuna nota, nessun prezzo.

export const DEALS_WINDOW = 200;
const ORPHANS_WINDOW = 100;

export type CommercialDealsData = {
  deals: CommercialDeal[];
  salesUnavailable: boolean;
  purchaseUnavailable: boolean;
  /** Almeno un lato ha riempito la finestra: possono esistere trattative più vecchie. */
  truncated: boolean;
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

type Db = Awaited<ReturnType<typeof createClient>>;

async function loadSales(db: Db, organizationId: string) {
  const full = "id,status,created_at,due_at,deal_label,company:companies!rfqs_company_id_fkey(name)," +
    "lines:rfq_lines!rfq_lines_rfq_id_fkey(" + LINE_FIELDS + ")," +
    "offers:offers!offers_rfq_id_fkey(" + OFFER_FIELDS + ")," +
    "orders:orders!orders_rfq_id_fkey(" + ORDER_FIELDS + ")";
  let rfqs = await db.from("rfqs").select(full)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .order("created_at", { referencedTable: "lines", ascending: true })
    .limit(ROW_LINES_FETCHED, { referencedTable: "lines" })
    .limit(DEALS_WINDOW);
  // Le righe articolo sono un arricchimento: se la lettura combinata fallisce,
  // la trattativa resta visibile con documenti e stati, senza materiale.
  if (rfqs.error) {
    rfqs = await db.from("rfqs").select(
      "id,status,created_at,due_at,deal_label,company:companies!rfqs_company_id_fkey(name)," +
      "offers:offers!offers_rfq_id_fkey(" + OFFER_FIELDS + "),orders:orders!orders_rfq_id_fkey(" + ORDER_FIELDS + ")")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(DEALS_WINDOW);
  }
  const [offers, orders] = await Promise.all([
    db.from("offers")
      .select(OFFER_FIELDS + ",company:companies!offers_company_id_fkey(name),orders:orders!orders_offer_id_fkey(" + ORDER_FIELDS + ")")
      .eq("organization_id", organizationId).is("rfq_id", null)
      .order("created_at", { ascending: false }).limit(ORPHANS_WINDOW),
    db.from("orders")
      .select(ORDER_FIELDS + ",deal_label,company:companies!orders_company_id_fkey(name)")
      .eq("organization_id", organizationId).is("rfq_id", null).is("offer_id", null)
      .order("created_at", { ascending: false }).limit(ORPHANS_WINDOW),
  ]);
  return {
    deals: rfqs.error ? [] : salesDealsFromRows(rfqs.data, offers.error ? [] : offers.data, orders.error ? [] : orders.data, routes),
    unavailable: Boolean(rfqs.error),
    full: (rfqs.data?.length ?? 0) >= DEALS_WINDOW,
  };
}

async function loadPurchase(db: Db, organizationId: string) {
  const full = "id,title,status,due_at,created_at,source_distinta_id," +
    "distinta:buyer_distintas!buyer_rfq_campaigns_source_distinta_id_fkey(line_count,total_tonnes,total_meters)," +
    "suppliers:buyer_rfq_suppliers!buyer_rfq_suppliers_rfq_id_fkey(status)," +
    "quotes:buyer_rfq_quotes!buyer_rfq_quotes_rfq_id_fkey(id,supplier_id,status,submitted_at,created_at)," +
    "orders:buyer_purchase_order_drafts!buyer_purchase_order_drafts_rfq_id_fkey(id,status,po_draft_ref,supplier_name_snapshot,created_at)";
  let campaigns = await db.from("buyer_rfq_campaigns").select(full)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(DEALS_WINDOW);
  if (campaigns.error) {
    campaigns = await db.from("buyer_rfq_campaigns").select("id,title,status,due_at,created_at,source_distinta_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(DEALS_WINDOW);
  }
  const distinte = await db.from("buyer_distintas")
    .select("id,title,line_count,total_tonnes,total_meters,created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false }).limit(ORPHANS_WINDOW);
  // Una distinta già usata da una RFQ (anche fuori finestra) non è una bozza.
  const distintaIds = (distinte.data ?? []).map((row) => row.id).filter((id): id is string => typeof id === "string");
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

export async function loadCommercialDeals(organizationId: string): Promise<CommercialDealsData> {
  const db = await createClient();
  const [sales, purchase] = await Promise.all([
    loadSales(db, organizationId).catch(() => ({ deals: [], unavailable: true, full: false })),
    loadPurchase(db, organizationId).catch(() => ({ deals: [], unavailable: true, full: false })),
  ]);
  return {
    deals: [...sales.deals, ...purchase.deals],
    salesUnavailable: sales.unavailable,
    purchaseUnavailable: purchase.unavailable,
    truncated: sales.full || purchase.full,
  };
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
