// COMM-DEALS1 — una riga = una trattativa.
//
// La lista Commerciale mostrava un documento per riga: richiesta, offerta e
// ordine dello stesso cliente su tre righe; una RFQ con cinque risposte su sette.
// Qui i documenti vengono raggruppati nella trattativa a cui appartengono:
//   · vendita  = richiesta cliente (rfqs) + offerte e ordini collegati da rfq_id
//   · acquisto = RFQ ai fornitori (buyer_rfq_campaigns) + fornitori, risposte e PO
//   · bozza    = distinta salvata non ancora usata per una RFQ (solo nel filtro Bozze)
//
// Modulo puro: niente database, niente testo libero delle email, niente prezzi.
// Solo stati, date, quantità e nomi già autorizzati da RLS a monte.

import { summarizeRowLines } from "./commercial-row-lines.ts";
import { commercialRowQuantity } from "./commercial-row-facts.ts";
import { productSummary } from "./commercial-product-key.ts";
import type { DealCycleState, DealOutcome } from "./commercial-cycle.ts";

export type DealSide = "sales" | "purchase";
export type DealSegment = "all" | DealSide;
export type DealFilter = "todo" | "waiting" | "due" | "drafts" | "review" | "closed";
/** Dove sta la trattativa adesso. «due» non è un bucket: è una scadenza sopra un bucket aperto. */
/** «review» (COMM-REVIEW1): ordine ricevuto da oltre 30 giorni e mai confermato, fuori da «Da fare». */
export type DealBucket = "todo" | "waiting" | "drafts" | "progress" | "review" | "closed";
export type DealKind = "inbound-rfq" | "inbound-offer" | "inbound-order" | "campaign" | "distinta";
/** «skipped»: the step did not happen and never will (an order that came without a request). */
export type DealStep = { label: string; done: boolean; skipped?: boolean };
export type DealDocument = { key: string; label: string; status: string; at: string | null; href: string };
export type DealOperationTab = "compare" | "negotiate" | "award" | "po";

export type CommercialDeal = {
  key: string;
  kind: DealKind;
  side: DealSide;
  id: string;
  reference: string;
  title: string;
  counterparty: string;
  material: string;
  quantity: string;
  steps: DealStep[];
  stage: string;
  action: string;
  bucket: DealBucket;
  dueAt: string | null;
  at: string | null;
  href: string;
  campaignId: string | null;
  distintaId: string | null;
  /** Etichetta personale della trattativa (solo vendite). */
  label: string | null;
  /** Scheda operativa da aprire con il pulsante principale (solo acquisti). */
  operationTab: DealOperationTab | null;
  documents: DealDocument[];
  /** Chiavi dei documenti figli: i vecchi link ?item=quote:… aprono la trattativa giusta. */
  childKeys: string[];
  /** COMM-RDO2 (solo vendite): come è nata la trattativa, «Richiesta», «Ordine diretto»… */
  origin?: string;
  /** COMM-RDO2 (solo vendite): data commerciale del documento di partenza (non quella di importazione). */
  since?: string | null;
  /** COMM-CYCLE1 (solo vendite): stato grezzo di richiesta, ultima offerta e ultimo ordine, per le azioni. */
  cycle?: DealCycleState;
  /** COMM-CYCLE1: chiusa come non conclusa (motivo e nota), letta da comm_deal_events. */
  outcome?: DealOutcome | null;
};

export const DEAL_DUE_WINDOW_DAYS = 7;
/** COMM-REVIEW1 (25 nov 2026): stessa soglia dell'indice SQL (interval '30 days'). */
export const DEAL_REVIEW_AFTER_DAYS = 30;
const DAY = 86_400_000;

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : "";
const time = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === "object") : [];
const parent = (value: unknown): Row | null => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? row as Row : null;
};
/** Il documento più recente: le trattative avanzano per documento, non per riga. */
const latest = (list: Row[]) => [...list].sort((a, b) =>
  (Date.parse(String(b.created_at ?? "")) || 0) - (Date.parse(String(a.created_at ?? "")) || 0))[0] ?? null;

export const dealReference = (side: DealSide, id: string) =>
  (side === "sales" ? "RDO-" : "RFQ-") + id.replace(/-/g, "").slice(0, 6).toUpperCase();

/** COMM-RDO2: an order or offer that arrived without a request is not an «RDO». */
export const salesReference = (kind: DealKind, id: string) =>
  (kind === "inbound-order" ? "ORD-" : kind === "inbound-offer" ? "OFF-" : "RDO-") + id.replace(/-/g, "").slice(0, 6).toUpperCase();

/**
 * public.comm_deals2_index searches the code as «RDO-xxxxxx» for every sales
 * deal; the list now shows ORD-/OFF- for orders and offers without a request.
 * Same 6 characters, so the query is translated before it reaches the index.
 */
export function salesSearchQuery(query: string): string {
  return query.replace(/\b(?:ORD|OFF)-([0-9A-F]{6})\b/gi, "RDO-$1");
}

// Etichette italiane degli stati di database (vincoli verificati sullo schema).
const rfqStatus: Record<string, string> = {
  new: "Nuova", review_needed: "Da valutare", qualified: "Qualificata", in_progress: "In lavorazione",
  quoted: "Offerta fatta", closed_won: "Vinta", closed_lost: "Persa", cancelled: "Annullata",
};
const offerStatus: Record<string, string> = {
  draft: "Bozza", sent: "Inviata", accepted: "Accettata", rejected: "Rifiutata", expired: "Scaduta",
};
const orderStatus: Record<string, string> = {
  received: "Ricevuto", confirmed: "Confermato", in_production: "In produzione", ready: "Pronto",
  shipped: "Spedito", delivered: "Consegnato", cancelled: "Annullato",
};
const campaignStatus: Record<string, string> = {
  draft: "Bozza", ready: "Pronta", launched: "Inviata", collecting: "Raccolta offerte",
  awarded: "Aggiudicata", closed: "Chiusa", cancelled: "Annullata",
};
const poStatus: Record<string, string> = {
  draft: "Bozza", issued: "Emesso", supplier_confirmed: "Confermato", supplier_rejected: "Rifiutato",
  change_requested: "Modifica richiesta", cancelled: "Annullato",
};
const label = (map: Record<string, string>, value: unknown) => map[text(value)] ?? (text(value) || "—");

export type DealRoutes = {
  rfq: (id: string) => string;
  offer: (id: string) => string;
  order: (id: string) => string;
  campaign: (id: string) => string;
  distinta: (id: string) => string;
};

/** Norma e grado delle righe richieste: dati strutturati, mai il testo dell'email. */
function salesMaterial(lines: Row[]): string {
  const specs = [...new Set(lines
    .map((line) => [text(line.requested_standard), text(line.requested_grade)].filter(Boolean).join(" "))
    .filter(Boolean))];
  if (!specs.length) return "";
  return specs.length === 1 ? specs[0] : specs[0] + " +" + (specs.length - 1);
}

type SalesInput = { rfq?: Row | null; offers: Row[]; orders: Row[]; anchor: Row; anchorKind: "inbound-rfq" | "inbound-offer" | "inbound-order" };

function buildSalesDeal(input: SalesInput, routes: DealRoutes): CommercialDeal | null {
  const { rfq, offers, orders, anchor, anchorKind } = input;
  if (!isId(anchor.id)) return null;
  const id = anchor.id;
  const company = text(parent(anchor.company)?.name) ||
    text(parent(offers[0]?.company)?.name) || text(parent(orders[0]?.company)?.name);
  // Senza azienda collegata, il nome del contatto della richiesta (dato strutturato).
  const contact = text(parent(rfq?.contact)?.full_name);
  const dealLabel = text(anchor.deal_label) || text(offers.find((o) => text(o.deal_label))?.deal_label) || "";
  const order = latest(orders);
  const offer = latest(offers);
  const rfqState = rfq ? text(rfq.status) : "";

  let action: string, bucket: DealBucket, stage: string;
  if (order) {
    const s = text(order.status);
    stage = "Ordine " + label(orderStatus, s).toLocaleLowerCase("it-IT");
    if (s === "received") {
      // COMM-REVIEW1: registrato da oltre 30 giorni e mai confermato = da verificare.
      const receivedAt = Date.parse(text(order.created_at));
      const stale = Number.isFinite(receivedAt) && receivedAt < Date.now() - DEAL_REVIEW_AFTER_DAYS * DAY;
      if (stale) { action = "Verifica: conferma o chiudi"; bucket = "review"; }
      else { action = "Conferma l'ordine"; bucket = "todo"; }
    }
    else if (s === "delivered") { action = "Consegnato"; bucket = "closed"; }
    else if (s === "cancelled") { action = "Ordine annullato"; bucket = "closed"; }
    else if (s === "shipped") { action = "In consegna"; bucket = "progress"; }
    else { action = "In produzione"; bucket = "progress"; }
  } else if (offer) {
    const s = text(offer.status);
    stage = "Offerta " + label(offerStatus, s).toLocaleLowerCase("it-IT");
    if (s === "draft") { action = "Completa e invia l'offerta"; bucket = "todo"; }
    // COMM-CYCLE1: oltre la validità tocca a noi, non al cliente (stessa regola dell'indice SQL).
    else if (s === "sent" && offerExpired(offer)) { stage = "Offerta scaduta"; action = "Offerta scaduta: rinnova o chiudi"; bucket = "todo"; }
    else if (s === "sent") { action = "In attesa del cliente"; bucket = "waiting"; }
    else if (s === "accepted") { action = "Registra l'ordine"; bucket = "todo"; }
    else if (s === "expired") { action = "Rinnova l'offerta"; bucket = "todo"; }
    else { action = "Offerta rifiutata"; bucket = "closed"; }
  } else {
    stage = "Richiesta " + label(rfqStatus, rfqState).toLocaleLowerCase("it-IT");
    if (rfqState === "new" || rfqState === "review_needed") { action = "Valuta la richiesta"; bucket = "todo"; }
    else if (rfqState === "quoted") { action = "In attesa del cliente"; bucket = "waiting"; }
    else if (rfqState === "closed_won") { action = "Vinta"; bucket = "closed"; }
    else if (rfqState === "closed_lost") { action = "Persa"; bucket = "closed"; }
    else if (rfqState === "cancelled") { action = "Annullata"; bucket = "closed"; }
    else { action = "Prepara l'offerta"; bucket = "todo"; }
  }
  // Una richiesta chiusa a mano chiude anche la trattativa, salvo un ordine ancora in corso.
  if (rfq && ["closed_won", "closed_lost", "cancelled"].includes(rfqState) && bucket !== "progress" && !(order && text(order.status) === "received")) {
    bucket = "closed";
    action = label(rfqStatus, rfqState);
  }

  const lines = rows(rfq?.lines ?? anchor.lines);
  const facts = summarizeRowLines(lines);
  const product = productSummary(lines);
  const customerRef = text(order?.customer_order_ref);
  const documents: DealDocument[] = [];
  if (rfq && isId(rfq.id)) documents.push({ key: "inbound-rfq:" + rfq.id, label: "Richiesta del cliente", status: label(rfqStatus, rfq.status), at: time(rfq.created_at), href: routes.rfq(rfq.id) });
  for (const o of offers) if (isId(o.id)) documents.push({ key: "inbound-offer:" + o.id, label: "Offerta", status: label(offerStatus, o.status), at: time(o.created_at), href: routes.offer(o.id) });
  for (const o of orders) if (isId(o.id)) documents.push({
    key: "inbound-order:" + o.id, label: "Ordine" + (text(o.customer_order_ref) ? " " + text(o.customer_order_ref).slice(0, 24) : ""),
    status: label(orderStatus, o.status), at: time(o.created_at), href: routes.order(o.id),
  });
  const at = documents.reduce<string | null>((max, d) => d.at && (!max || Date.parse(d.at) > Date.parse(max)) ? d.at : max, null);

  const offered = offers.some((o) => text(o.status) !== "draft");
  const ordered = orders.some((o) => text(o.status) !== "cancelled");
  const negotiated = offers.length > 0 || ["in_progress", "qualified", "quoted", "closed_won", "closed_lost"].includes(rfqState);
  const sinceRaw = anchorKind === "inbound-rfq" ? anchor.requested_at
    : anchorKind === "inbound-offer" ? anchor.offered_at : anchor.ordered_at;

  return {
    key: anchorKind + ":" + id, kind: anchorKind, side: "sales", id,
    // RDO = richiesta del cliente; OFF/ORD = offerta o ordine arrivati senza richiesta.
    reference: salesReference(anchorKind, id) + (customerRef ? " · ord. " + customerRef.slice(0, 24) : ""),
    title: dealLabel || product?.name || "Articoli da leggere nel dettaglio",
    counterparty: company || contact,
    material: salesMaterial(lines) || product?.spec || "",
    quantity: [facts.lines && facts.lines !== "1 riga" ? facts.lines : "", facts.quantity ?? ""].filter(Boolean).join(" · "),
    // COMM-CYCLE1: le fasi del ciclo deciso il 19 nov 2026. La consegna resta nello stato a parole.
    steps: [
      { label: "Richiesta", done: Boolean(rfq), skipped: !rfq },
      { label: "Trattativa", done: negotiated, skipped: !rfq && !offers.length && ordered },
      { label: "Offerta", done: offered, skipped: !rfq && !offers.length && ordered },
      { label: "Ordine", done: ordered },
    ],
    stage, action, bucket,
    dueAt: rfq ? time(rfq.due_at) : null,
    at,
    href: documents[0]?.href ?? routes.rfq(id),
    campaignId: null, distintaId: null,
    label: dealLabel || null,
    operationTab: null,
    documents,
    childKeys: documents.map((d) => d.key),
    origin: anchorKind === "inbound-rfq" ? "Richiesta" : anchorKind === "inbound-offer" ? "Offerta senza richiesta" : "Ordine diretto",
    since: time(sinceRaw) ?? time(anchor.created_at),
    cycle: {
      rfq: rfq && isId(rfq.id) ? { id: rfq.id, status: rfqState } : null,
      offer: offer && isId(offer.id) ? { id: offer.id, status: text(offer.status), expired: offerExpired(offer) } : null,
      order: order && isId(order.id) ? { id: order.id, status: text(order.status) } : null,
    },
  };
}

/** Un'offerta inviata la cui validità (data, senza ora) è già passata. */
function offerExpired(offer: Row): boolean {
  const until = text(offer.valid_until).slice(0, 10);
  if (text(offer.status) !== "sent" || !/^\d{4}-\d{2}-\d{2}$/.test(until)) return false;
  return until < new Date().toISOString().slice(0, 10);
}

/** Richieste cliente con le offerte e gli ordini incorporati (stessa query, RLS). */
export function salesDealsFromRows(rfqRows: unknown, orphanOffers: unknown, orphanOrders: unknown, routes: DealRoutes): CommercialDeal[] {
  const deals: CommercialDeal[] = [];
  for (const rfq of rows(rfqRows)) {
    const deal = buildSalesDeal({ rfq, offers: rows(rfq.offers), orders: rows(rfq.orders), anchor: rfq, anchorKind: "inbound-rfq" }, routes);
    if (deal) deals.push(deal);
  }
  // Offerte senza richiesta: la trattativa parte dall'offerta, con i suoi ordini.
  for (const offer of rows(orphanOffers)) {
    const deal = buildSalesDeal({ rfq: null, offers: [offer], orders: rows(offer.orders), anchor: offer, anchorKind: "inbound-offer" }, routes);
    if (deal) deals.push(deal);
  }
  // Ordini senza richiesta né offerta: una trattativa a sé.
  for (const order of rows(orphanOrders)) {
    const deal = buildSalesDeal({ rfq: null, offers: [], orders: [order], anchor: order, anchorKind: "inbound-order" }, routes);
    if (deal) deals.push(deal);
  }
  return deals;
}

const INVITED = new Set(["queued", "sent", "delivered", "opened", "responded", "declined", "awarded", "not_awarded"]);

export function purchaseDealFromRow(campaign: Row, routes: DealRoutes): CommercialDeal | null {
  if (!isId(campaign.id)) return null;
  const id = campaign.id;
  const s = text(campaign.status);
  const suppliers = rows(campaign.suppliers);
  const invited = suppliers.filter((x) => INVITED.has(text(x.status))).length;
  const quotes = rows(campaign.quotes).filter((q) => text(q.status) === "submitted");
  const responded = new Set(quotes.map((q) => text(q.supplier_id) || text(q.id))).size;
  const pos = rows(campaign.orders).filter((po) => text(po.status) !== "cancelled");
  const poStates = new Set(pos.map((po) => text(po.status)));
  const distinta = parent(campaign.distinta);

  let action: string, bucket: DealBucket, stage: string, operationTab: DealOperationTab | null = null;
  if (s === "draft" || s === "ready") {
    stage = label(campaignStatus, s);
    action = s === "ready" ? "Invia ai fornitori" : "Completa e invia ai fornitori";
    bucket = "drafts";
  } else if (s === "launched" || s === "collecting") {
    const answers = responded + (responded === 1 ? " risposta" : " risposte");
    stage = invited ? answers + " su " + invited : responded ? answers : "Inviata";
    if (responded) { action = "Confronta le offerte"; bucket = "todo"; operationTab = "compare"; }
    else { action = "In attesa dei fornitori"; bucket = "waiting"; }
  } else if (s === "awarded") {
    operationTab = "po";
    if (!pos.length || poStates.has("draft")) { stage = "Aggiudicata"; action = "Emetti l'ordine"; bucket = "todo"; }
    else if (poStates.has("change_requested") || poStates.has("supplier_rejected")) { stage = "Ordine da rivedere"; action = "Rivedi l'ordine"; bucket = "todo"; }
    else if (poStates.has("issued")) { stage = "Ordine emesso"; action = "In attesa conferma fornitore"; bucket = "waiting"; }
    else { stage = "Ordine confermato"; action = "Ordine confermato"; bucket = "progress"; }
  } else {
    stage = label(campaignStatus, s);
    action = s === "cancelled" ? "Annullata" : "Chiusa";
    bucket = "closed";
  }

  const supplierName = text(pos[0]?.supplier_name_snapshot);
  const counterparty = supplierName
    ? supplierName + (pos.length > 1 ? " +" + (pos.length - 1) : "")
    : invited ? invited + (invited === 1 ? " fornitore" : " fornitori") : "Fornitori da scegliere";
  const lineCount = Number(distinta?.line_count);
  const quantity = [
    Number.isSafeInteger(lineCount) && lineCount > 1 ? lineCount + " righe" : "",
    commercialRowQuantity(distinta?.total_tonnes, distinta?.total_meters) ?? "",
  ].filter(Boolean).join(" · ");

  const documents: DealDocument[] = [{
    key: "campaign:" + id, label: "RFQ ai fornitori", status: label(campaignStatus, s),
    at: time(campaign.created_at), href: routes.campaign(id),
  }];
  for (const q of quotes) if (isId(q.id)) documents.push({ key: "quote:" + q.id, label: "Risposta fornitore", status: "Ricevuta", at: time(q.submitted_at ?? q.created_at), href: routes.campaign(id) });
  for (const po of rows(campaign.orders)) if (isId(po.id)) documents.push({
    key: "purchase-order:" + po.id,
    label: "Ordine " + (text(po.po_draft_ref) || "di acquisto") + (text(po.supplier_name_snapshot) ? " · " + text(po.supplier_name_snapshot) : ""),
    status: label(poStatus, po.status), at: time(po.created_at), href: routes.campaign(id),
  });
  const at = documents.reduce<string | null>((max, d) => d.at && (!max || Date.parse(d.at) > Date.parse(max)) ? d.at : max, null);
  const distintaId = isId(campaign.source_distinta_id) ? campaign.source_distinta_id : null;

  return {
    key: "campaign:" + id, kind: "campaign", side: "purchase", id,
    reference: dealReference("purchase", id),
    title: text(campaign.title) || "Richiesta ai fornitori",
    counterparty, material: "", quantity,
    steps: [
      { label: "Inviata", done: !["draft", "ready"].includes(s) && s !== "cancelled" },
      { label: "Risposte", done: responded > 0 },
      { label: "Aggiudicata", done: s === "awarded" || pos.length > 0 },
      { label: "Ordine", done: [...poStates].some((x) => x !== "draft") },
    ],
    stage, action, bucket,
    dueAt: bucket === "closed" ? null : time(campaign.due_at),
    at, href: routes.campaign(id), campaignId: id, distintaId,
    label: null, operationTab, documents,
    childKeys: documents.map((d) => d.key),
  };
}

export function purchaseDealsFromRows(campaignRows: unknown, routes: DealRoutes): CommercialDeal[] {
  return rows(campaignRows).map((row) => purchaseDealFromRow(row, routes)).filter((d): d is CommercialDeal => d !== null);
}

/** Distinte salvate e mai usate per una RFQ: bozze d'acquisto, visibili solo nel filtro Bozze. */
export function distintaDealsFromRows(distintaRows: unknown, usedDistintaIds: ReadonlySet<string>, routes: DealRoutes): CommercialDeal[] {
  return rows(distintaRows).filter((row) => isId(row.id) && !usedDistintaIds.has(row.id as string)).map((row) => {
    const id = row.id as string;
    const lineCount = Number(row.line_count);
    return {
      key: "distinta:" + id, kind: "distinta" as const, side: "purchase" as const, id,
      reference: "Distinta", title: text(row.title) || "Distinta senza titolo",
      counterparty: "Fornitori da scegliere", material: "",
      quantity: [Number.isSafeInteger(lineCount) && lineCount > 0 ? lineCount + (lineCount === 1 ? " riga" : " righe") : "",
        commercialRowQuantity(row.total_tonnes, row.total_meters) ?? ""].filter(Boolean).join(" · "),
      steps: [{ label: "Inviata", done: false }, { label: "Risposte", done: false }, { label: "Aggiudicata", done: false }, { label: "Ordine", done: false }],
      stage: "Distinta salvata", action: "Crea la RFQ", bucket: "drafts" as const,
      dueAt: null, at: time(row.created_at), href: routes.distinta(id),
      campaignId: null, distintaId: id, label: null, operationTab: null,
      documents: [{ key: "distinta:" + id, label: "Distinta", status: "Salvata", at: time(row.created_at), href: routes.distinta(id) }],
      childKeys: ["distinta:" + id],
    };
  });
}

// ── Priorità, filtri, conteggi ────────────────────────────────────────────────

export function isDealDue(deal: CommercialDeal, now = Date.now()): boolean {
  if (deal.bucket === "closed" || !deal.dueAt) return false;
  const due = Date.parse(deal.dueAt);
  return Number.isFinite(due) && due <= now + DEAL_DUE_WINDOW_DAYS * DAY;
}

/** 0 = più urgente. Le scadenze vicine passano davanti a tutto il resto del proprio bucket. */
export function dealUrgency(deal: CommercialDeal, now = Date.now()): number {
  const due = isDealDue(deal, now);
  if (deal.bucket === "todo") return due ? 0 : 1;
  if (deal.bucket === "waiting") return due ? 2 : 4;
  if (deal.bucket === "drafts") return 3;
  if (deal.bucket === "progress") return 5;
  if (deal.bucket === "review") return 6;
  return 7;
}

export function sortDeals(deals: readonly CommercialDeal[], now = Date.now()): CommercialDeal[] {
  const dueOf = (d: CommercialDeal) => d.dueAt ? Date.parse(d.dueAt) : Number.POSITIVE_INFINITY;
  const atOf = (d: CommercialDeal) => d.at ? Date.parse(d.at) : 0;
  return [...deals].sort((a, b) =>
    dealUrgency(a, now) - dealUrgency(b, now) ||
    (isDealDue(a, now) || isDealDue(b, now) ? dueOf(a) - dueOf(b) : 0) ||
    atOf(b) - atOf(a) ||
    a.key.localeCompare(b.key));
}

/** Le distinte senza RFQ compaiono solo nel filtro Bozze. */
export function dealMatches(deal: CommercialDeal, segment: DealSegment, filter: DealFilter | "", query: string, now = Date.now()): boolean {
  if (segment !== "all" && deal.side !== segment) return false;
  if (deal.kind === "distinta" && filter !== "drafts") return false;
  if (filter === "due" && !isDealDue(deal, now)) return false;
  if (filter && filter !== "due" && deal.bucket !== filter) return false;
  // Senza filtro le trattative chiuse restano in fondo, non spariscono.
  const needle = query.trim().toLocaleLowerCase("it-IT");
  if (!needle) return true;
  return [deal.title, deal.counterparty, deal.reference, deal.material, deal.stage]
    .some((value) => value.toLocaleLowerCase("it-IT").includes(needle));
}

export type DealCounts = { segments: Record<DealSegment, number>; filters: Record<DealFilter, number> };

/** Conteggi aperti: i segmenti non contano chiuse e distinte, i filtri seguono il segmento scelto. */
export function countDeals(deals: readonly CommercialDeal[], segment: DealSegment, now = Date.now()): DealCounts {
  const open = (d: CommercialDeal) => d.bucket !== "closed" && d.kind !== "distinta";
  const inSegment = deals.filter((d) => segment === "all" || d.side === segment);
  return {
    segments: {
      all: deals.filter(open).length,
      sales: deals.filter((d) => d.side === "sales" && open(d)).length,
      purchase: deals.filter((d) => d.side === "purchase" && open(d)).length,
    },
    filters: {
      todo: inSegment.filter((d) => d.bucket === "todo").length,
      waiting: inSegment.filter((d) => d.bucket === "waiting").length,
      due: inSegment.filter((d) => isDealDue(d, now)).length,
      drafts: inSegment.filter((d) => d.bucket === "drafts").length,
      review: inSegment.filter((d) => d.bucket === "review").length,
      closed: inSegment.filter((d) => d.bucket === "closed").length,
    },
  };
}

/** Un vecchio link a un documento (offerta, risposta, PO) apre la trattativa che lo contiene. */
export function resolveDealKey(deals: readonly CommercialDeal[], key: string): string {
  if (!key) return "";
  return deals.find((d) => d.key === key)?.key ?? deals.find((d) => d.childKeys.includes(key))?.key ?? "";
}

// ── Stato nell'URL ────────────────────────────────────────────────────────────

export type DealDeskState = { segment: DealSegment; filter: DealFilter | ""; query: string; page: number; item: string };

/**
 * Traduce sia i parametri nuovi (seg, f, p) sia quelli della lista precedente
 * (view, focus, page): sidebar, dashboard, chat e segnalibri continuano a funzionare.
 */
export function parseDealDeskState(params: Record<string, string | undefined>): DealDeskState {
  const seg = params.seg === "sales" || params.seg === "purchase" ? params.seg :
    params.view === "received" ? "sales" : params.view === "sent" ? "purchase" : "all";
  const filters: readonly DealFilter[] = ["todo", "waiting", "due", "drafts", "review", "closed"];
  const legacyFocus: Record<string, DealFilter> = { reply: "todo", waiting: "waiting", due: "due" };
  const filter: DealFilter | "" = filters.includes(params.f as DealFilter) ? params.f as DealFilter :
    params.view === "drafts" ? "drafts" : legacyFocus[params.focus ?? ""] ?? "";
  const page = Number(params.p ?? params.page);
  return {
    segment: seg,
    filter,
    query: typeof params.q === "string" ? params.q.trim().slice(0, 80) : "",
    page: Number.isSafeInteger(page) && page > 1 && page <= 500 ? page : 1,
    item: typeof params.item === "string" ? params.item.slice(0, 90) : "",
  };
}

export function dealDeskHref(state: Partial<DealDeskState> & { tab?: DealOperationTab | null }, anchor = "commercial-worklist"): string {
  const params = new URLSearchParams();
  if (state.segment && state.segment !== "all") params.set("seg", state.segment);
  if (state.filter) params.set("f", state.filter);
  if (state.query?.trim()) params.set("q", state.query.trim().slice(0, 80));
  if (state.page && state.page > 1) params.set("p", String(state.page));
  if (state.item) params.set("item", state.item);
  if (state.tab) params.set("tab", state.tab);
  const search = params.toString();
  return "/commercial" + (search ? "?" + search : "") + (anchor ? "#" + anchor : "");
}

// ── Pagina della lista ────────────────────────────────────────────────────────

export type DealPageView = {
  rows: CommercialDeal[];
  total: number;
  page: number;
  pages: number;
  counts: DealCounts;
};

/** Ripiego della fase 1: filtro, priorità e pagina calcolati sulla finestra caricata. */
export function pageFromDeals(deals: readonly CommercialDeal[], state: DealDeskState, pageSize: number, now = Date.now()): DealPageView {
  const visible = sortDeals(deals.filter((deal) => dealMatches(deal, state.segment, state.filter, state.query, now)), now);
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const page = Math.min(state.page, pages);
  return {
    rows: visible.slice((page - 1) * pageSize, page * pageSize),
    total: visible.length, page, pages,
    counts: countDeals(deals, state.segment, now),
  };
}

export type DealIndexKey = { key: string; kind: DealKind; id: string };
export type DealIndex = { total: number; keys: DealIndexKey[]; counts: DealCounts };

const INDEX_KINDS: readonly DealKind[] = ["inbound-rfq", "inbound-offer", "inbound-order", "campaign", "distinta"];
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;

/** Risposta di public.comm_deals2_index: accettata solo se il contratto è quello atteso. */
export function parseDealIndex(value: unknown): DealIndex | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Row;
  if (raw.contract !== "comm-deals2-v1" || !Array.isArray(raw.keys)) return null;
  const counts = parent(raw.counts);
  const segmentsRaw = parent(counts?.segments);
  const filtersRaw = parent(counts?.filters);
  if (!segmentsRaw || !filtersRaw) return null;
  const keys: DealIndexKey[] = [];
  for (const entry of rows(raw.keys)) {
    const kind = entry.kind as DealKind;
    if (!INDEX_KINDS.includes(kind) || !isId(entry.id) || entry.key !== kind + ":" + entry.id) return null;
    keys.push({ key: entry.key, kind, id: entry.id });
  }
  return {
    total: count(raw.total),
    keys,
    counts: {
      segments: { all: count(segmentsRaw.all), sales: count(segmentsRaw.sales), purchase: count(segmentsRaw.purchase) },
      filters: {
        todo: count(filtersRaw.todo), waiting: count(filtersRaw.waiting), due: count(filtersRaw.due),
        drafts: count(filtersRaw.drafts), review: count(filtersRaw.review), closed: count(filtersRaw.closed),
      },
    },
  };
}
