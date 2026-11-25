import "server-only";

import { canWriteWorkspace } from "@/lib/access-policy";
import {
  purchaseDealsFromRows, salesDealsFromRows, type CommercialDeal, type DealRoutes,
} from "@/lib/commercial-deal-model";
import {
  buildDirectorDesk, documentValue, type DealValue, type DeskDeal, type DeskMember, type DirectorDesk, type PricedLine,
} from "@/lib/director-desk-model";
import { officeProfileOf } from "@/lib/office-profiles";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

// DIR-DESK1 — dati della Scrivania della Direzione. Letture con il client
// dell'utente (RLS); la pagina è riservata agli amministratori dell'azienda,
// gli stessi che vedono «Team e profili». Nessun testo di email, nessuna nota.

const WINDOW = 200;
const routes: DealRoutes = {
  rfq: appRoutes.commercial.rfq,
  offer: appRoutes.commercial.offer,
  order: appRoutes.commercial.order,
  campaign: appRoutes.rfqHub.campaign,
  distinta: appRoutes.rfqHub.savedDistinta,
};

const COMPANY = (fk: string) => "company:companies!" + fk + "(name)";
const OFFER_LINES = "lines:offer_lines!offer_lines_offer_id_fkey(quantity,quantity_unit,price_value,price_unit,weight_kg_m,canonical_product_key,created_at)";
const ORDER_LINES = "lines:order_lines!order_lines_order_id_fkey(quantity,quantity_unit,unit_price,price_unit,canonical_product_key,created_at)";
const OFFER_FIELDS = "id,status,created_at,offered_at,valid_until,deal_label";
const ORDER_FIELDS = "id,status,created_at,ordered_at,customer_order_ref";

const SALES_SELECT = "id,status,created_at,requested_at,due_at,deal_label,assigned_to_user_id," +
  COMPANY("rfqs_company_id_fkey") + ",contact:contacts!rfqs_contact_id_fkey(full_name)," +
  "lines:rfq_lines!rfq_lines_rfq_id_fkey(requested_quantity,quantity_unit,requested_standard,requested_grade,canonical_product_key,created_at)," +
  "offers:offers!offers_rfq_id_fkey(" + OFFER_FIELDS + "," + OFFER_LINES + ")," +
  "orders:orders!orders_rfq_id_fkey(" + ORDER_FIELDS + "," + ORDER_LINES + ")";
const ORPHAN_OFFER_SELECT = OFFER_FIELDS + ",assigned_to_user_id," + COMPANY("offers_company_id_fkey") + "," + OFFER_LINES +
  ",orders:orders!orders_offer_id_fkey(" + ORDER_FIELDS + "," + ORDER_LINES + ")";
const ORPHAN_ORDER_SELECT = ORDER_FIELDS + ",deal_label,assigned_to_user_id," + COMPANY("orders_company_id_fkey") + "," + ORDER_LINES;
const CAMPAIGN_SELECT = "id,title,status,due_at,created_at,source_distinta_id,owner_user_id," +
  "distinta:buyer_distintas!buyer_rfq_campaigns_source_distinta_id_fkey(line_count,total_tonnes,total_meters)," +
  "suppliers:buyer_rfq_suppliers!buyer_rfq_suppliers_rfq_id_fkey(status)," +
  "quotes:buyer_rfq_quotes!buyer_rfq_quotes_rfq_id_fkey(id,supplier_id,status,submitted_at,created_at)," +
  "orders:buyer_purchase_order_drafts!buyer_purchase_order_drafts_rfq_id_fkey(id,status,po_draft_ref,supplier_name_snapshot,created_at,total_eur)";

type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter((r): r is Row => Boolean(r) && typeof r === "object") : [];
const str = (value: unknown) => typeof value === "string" ? value : null;

export type DeskApproval = {
  id: string;
  rfqId: string;
  rfqTitle: string;
  action: "award" | "po" | string;
  reason: string | null;
  requestedBy: string | null;
  requestedByEmail: string | null;
  requestedAt: string | null;
  expiresAt: string | null;
};

export type DirectorDeskData = DirectorDesk & {
  members: DeskMember[];
  approvals: DeskApproval[];
  approvalsUnavailable: boolean;
  salesUnavailable: boolean;
  purchaseUnavailable: boolean;
  /** Almeno una lettura ha riempito la finestra delle 200 più recenti. */
  truncated: boolean;
};

const offerLines = (lines: unknown): PricedLine[] => rows(lines).map((l) => ({
  quantity: l.quantity, quantityUnit: l.quantity_unit, price: l.price_value, priceUnit: l.price_unit, weightKgM: l.weight_kg_m,
}));
const orderLines = (lines: unknown): PricedLine[] => rows(lines).map((l) => ({
  quantity: l.quantity, quantityUnit: l.quantity_unit, price: l.unit_price, priceUnit: l.price_unit,
}));

const NO_VALUE: DealValue = { eur: null, unknown: false };
const PO_OPEN = new Set(["issued", "supplier_confirmed", "change_requested"]);

export async function loadDirectorDesk(organizationId: string): Promise<DirectorDeskData> {
  const db = await createClient();
  const [team, rfqs, orphanOffers, orphanOrders, campaigns, approvals] = await Promise.all([
    db.rpc("hp8_team_state", { p_organization_id: organizationId }),
    db.from("rfqs").select(SALES_SELECT).eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).limit(WINDOW),
    db.from("offers").select(ORPHAN_OFFER_SELECT).eq("organization_id", organizationId).is("rfq_id", null)
      .order("created_at", { ascending: false }).limit(WINDOW),
    db.from("orders").select(ORPHAN_ORDER_SELECT).eq("organization_id", organizationId).is("rfq_id", null).is("offer_id", null)
      .order("created_at", { ascending: false }).limit(WINDOW),
    db.from("buyer_rfq_campaigns").select(CAMPAIGN_SELECT).eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).limit(WINDOW),
    db.from("buyer_procurement_approvals")
      .select("id,rfq_id,action_type,reason,requested_by,requested_at,expires_at")
      .eq("organization_id", organizationId).eq("status", "pending")
      .order("requested_at", { ascending: true }).limit(50),
  ]);

  // Persone: solo i membri attivi. Il profilo decide l'ufficio.
  const teamMembers = rows((team.data as { members?: unknown } | null)?.members);
  const members: DeskMember[] = teamMembers
    .filter((m) => m.status === "active" && typeof m.user_id === "string")
    .map((m) => {
      const role = str(m.role) ?? "member";
      return {
        userId: m.user_id as string,
        email: str(m.email) ?? "—",
        office: officeProfileOf(role, str(m.business_role)),
        canWrite: canWriteWorkspace(role),
      };
    });
  const emailOf = new Map(members.map((m) => [m.userId, m.email]));

  const rfqRows = rows(rfqs.data);
  const offerRows = rows(orphanOffers.data);
  const orderRows = rows(orphanOrders.data);
  const campaignRows = rows(campaigns.data);

  // Indici per id: responsabile del documento di partenza e righe con prezzi.
  const assignee = new Map<string, string | null>();
  const offerById = new Map<string, Row>();
  const orderById = new Map<string, Row>();
  for (const r of rfqRows) {
    assignee.set("inbound-rfq:" + r.id, str(r.assigned_to_user_id));
    for (const o of rows(r.offers)) offerById.set(String(o.id), o);
    for (const o of rows(r.orders)) orderById.set(String(o.id), o);
  }
  for (const o of offerRows) {
    assignee.set("inbound-offer:" + o.id, str(o.assigned_to_user_id));
    offerById.set(String(o.id), o);
    for (const x of rows(o.orders)) orderById.set(String(x.id), x);
  }
  for (const o of orderRows) {
    assignee.set("inbound-order:" + o.id, str(o.assigned_to_user_id));
    orderById.set(String(o.id), o);
  }
  const campaignById = new Map(campaignRows.map((c) => [String(c.id), c]));

  function salesValue(deal: CommercialDeal): DealValue {
    const order = deal.cycle?.order;
    if (order && order.status !== "cancelled") return documentValue(orderLines(orderById.get(order.id)?.lines));
    const offer = deal.cycle?.offer;
    if (offer && offer.status !== "draft" && offer.status !== "rejected") return documentValue(offerLines(offerById.get(offer.id)?.lines));
    return NO_VALUE;
  }
  function purchaseValue(deal: CommercialDeal): DealValue {
    const pos = rows(campaignById.get(deal.id)?.orders).filter((po) => PO_OPEN.has(String(po.status)));
    if (!pos.length) return NO_VALUE;
    let total = 0;
    for (const po of pos) {
      const value = Number(po.total_eur);
      if (!Number.isFinite(value) || value < 0) return { eur: null, unknown: true };
      total += value;
    }
    return { eur: total, unknown: false };
  }

  const deals: DeskDeal[] = [
    ...salesDealsFromRows(rfqRows, offerRows, orderRows, routes).map((deal) => ({
      deal, responsibleId: assignee.get(deal.key) ?? null, value: salesValue(deal),
    })),
    ...purchaseDealsFromRows(campaignRows, routes).map((deal) => ({
      deal, responsibleId: str(campaignById.get(deal.id)?.owner_user_id), value: purchaseValue(deal),
    })),
  ];

  const pending: DeskApproval[] = rows(approvals.data)
    .filter((a) => !a.expires_at || Date.parse(String(a.expires_at)) > Date.now())
    .map((a) => ({
      id: String(a.id),
      rfqId: String(a.rfq_id),
      rfqTitle: str(campaignById.get(String(a.rfq_id))?.title) ?? "Richiesta ai fornitori",
      action: String(a.action_type),
      reason: str(a.reason),
      requestedBy: str(a.requested_by),
      requestedByEmail: emailOf.get(String(a.requested_by)) ?? null,
      requestedAt: str(a.requested_at),
      expiresAt: str(a.expires_at),
    }));

  return {
    ...buildDirectorDesk(deals, members),
    members,
    approvals: pending,
    approvalsUnavailable: Boolean(approvals.error),
    salesUnavailable: Boolean(rfqs.error || orphanOffers.error || orphanOrders.error || team.error),
    purchaseUnavailable: Boolean(campaigns.error),
    truncated: [rfqRows, offerRows, orderRows, campaignRows].some((list) => list.length >= WINDOW),
  };
}
