import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  countDeals, dealDeskHref, dealMatches, pageFromDeals, parseDealDeskState, parseDealIndex, purchaseDealFromRow,
  resolveDealKey, salesDealsFromRows, distintaDealsFromRows, sortDeals,
} from "../lib/commercial-deal-model.ts";

// COMM-DEALS1 — una riga = una trattativa.

const routes = {
  rfq: (id) => "/commercial/rfqs/" + id, offer: (id) => "/commercial/offers/" + id,
  order: (id) => "/commercial/orders/" + id, campaign: (id) => "/rfq-hub/" + id,
  distinta: (id) => "/rfq-hub/distinte/" + id,
};
const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const NOW = Date.parse("2026-11-17T10:00:00Z");

const rfqWithOfferAndOrder = {
  id: id(1), status: "quoted", created_at: "2026-11-01T10:00:00Z", due_at: null,
  company: { name: "Rossi Costruzioni" },
  lines: [{ requested_quantity: 24, quantity_unit: "barre", requested_standard: "EN 10219", requested_grade: "S355" }],
  offers: [{ id: id(2), status: "sent", created_at: "2026-11-03T10:00:00Z" }],
  orders: [{ id: id(3), status: "received", created_at: "2026-11-10T10:00:00Z", customer_order_ref: "PO-77" }],
};
const campaignWithQuotes = {
  id: id(10), title: "Tubo Ø608", status: "collecting", created_at: "2026-11-05T10:00:00Z", due_at: "2026-11-20T10:00:00Z",
  source_distinta_id: id(20),
  suppliers: [{ status: "sent" }, { status: "responded" }, { status: "responded" }, { status: "opened" }, { status: "draft" }],
  quotes: [
    { id: id(11), supplier_id: id(31), status: "submitted" },
    { id: id(12), supplier_id: id(32), status: "submitted" },
    { id: id(13), supplier_id: id(32), status: "superseded" },
  ],
  orders: [],
  distinta: { line_count: 3, total_tonnes: 18 },
};

test("richiesta, offerta e ordine dello stesso cliente sono una sola trattativa", () => {
  const deals = salesDealsFromRows([rfqWithOfferAndOrder], [], [], routes);
  assert.equal(deals.length, 1);
  const [deal] = deals;
  assert.equal(deal.key, "inbound-rfq:" + id(1));
  assert.equal(deal.counterparty, "Rossi Costruzioni");
  assert.equal(deal.material, "EN 10219 S355");
  assert.equal(deal.action, "Conferma l'ordine");
  assert.equal(deal.bucket, "todo");
  assert.deepEqual(deal.steps.map((s) => s.done), [true, true, true]);
  assert.deepEqual(deal.documents.map((d) => d.key), ["inbound-rfq:" + id(1), "inbound-offer:" + id(2), "inbound-order:" + id(3)]);
  assert.match(deal.reference, /^RDO-[0-9A-F]{6} · ord\. PO-77$/);
});

test("le risposte dei fornitori diventano «N risposte su M», non righe", () => {
  const deal = purchaseDealFromRow(campaignWithQuotes, routes);
  assert.equal(deal.stage, "2 risposte su 4");
  assert.equal(deal.counterparty, "4 fornitori");
  assert.equal(deal.action, "Confronta le offerte");
  assert.equal(deal.operationTab, "compare");
  assert.equal(deal.quantity, "3 righe · 18 t");
  // I vecchi link a una risposta aprono la trattativa che la contiene.
  assert.equal(resolveDealKey([deal], "quote:" + id(12)), "campaign:" + id(10));
  assert.equal(resolveDealKey([deal], "quote:" + id(99)), "");
});

test("RFQ aggiudicata: emettere, attendere o rivedere l'ordine", () => {
  const awarded = (orders) => purchaseDealFromRow({ ...campaignWithQuotes, status: "awarded", orders }, routes);
  assert.equal(awarded([]).action, "Emetti l'ordine");
  assert.equal(awarded([{ id: id(40), status: "issued", supplier_name_snapshot: "Acciai Nord" }]).bucket, "waiting");
  assert.equal(awarded([{ id: id(40), status: "issued", supplier_name_snapshot: "Acciai Nord" }]).counterparty, "Acciai Nord");
  assert.equal(awarded([{ id: id(40), status: "change_requested" }]).action, "Rivedi l'ordine");
});

test("priorità su tutta la finestra: le scadenze vicine passano davanti", () => {
  const sales = salesDealsFromRows([
    { id: id(50), status: "new", created_at: "2026-11-16T10:00:00Z", company: { name: "Nuovo" } },
    { id: id(51), status: "new", created_at: "2026-10-01T10:00:00Z", due_at: "2026-11-18T10:00:00Z", company: { name: "Urgente" } },
    { id: id(52), status: "closed_won", created_at: "2026-11-16T12:00:00Z", company: { name: "Chiusa" } },
  ], [], [], routes);
  const purchase = [purchaseDealFromRow({ ...campaignWithQuotes, status: "launched", quotes: [] }, routes)];
  const order = sortDeals([...sales, ...purchase], NOW).map((d) => d.counterparty);
  assert.deepEqual(order, ["Urgente", "Nuovo", "4 fornitori", "Chiusa"]);
});

test("le distinte già usate da una RFQ non sono bozze; quelle libere solo nel filtro Bozze", () => {
  const distinte = distintaDealsFromRows([{ id: id(20), title: "Usata" }, { id: id(21), title: "Libera", line_count: 2 }], new Set([id(20)]), routes);
  assert.deepEqual(distinte.map((d) => d.title), ["Libera"]);
  const [free] = distinte;
  assert.equal(dealMatches(free, "all", "", "", NOW), false);
  assert.equal(dealMatches(free, "all", "drafts", "", NOW), true);
  assert.equal(dealMatches(free, "sales", "drafts", "", NOW), false);
  const counts = countDeals([free], "all", NOW);
  assert.equal(counts.segments.all, 0);
  assert.equal(counts.filters.drafts, 1);
});

test("i vecchi parametri della lista restano validi", () => {
  assert.deepEqual(parseDealDeskState({ view: "received" }), { segment: "sales", filter: "", query: "", page: 1, item: "" });
  assert.equal(parseDealDeskState({ view: "sent" }).segment, "purchase");
  assert.equal(parseDealDeskState({ view: "drafts" }).filter, "drafts");
  assert.equal(parseDealDeskState({ focus: "reply" }).filter, "todo");
  assert.equal(parseDealDeskState({ focus: "due" }).filter, "due");
  assert.equal(parseDealDeskState({ seg: "purchase", f: "waiting", p: "3" }).page, 3);
  assert.equal(parseDealDeskState({ f: "nonsense", p: "-1" }).filter, "");
  assert.equal(dealDeskHref({ segment: "sales", filter: "todo", query: "rossi", page: 2 }),
    "/commercial?seg=sales&f=todo&q=rossi&p=2#commercial-worklist");
});

test("la lista non legge testo delle email né prezzi", () => {
  const loader = readFileSync(new URL("../lib/commercial-deals.ts", import.meta.url), "utf8");
  for (const forbidden of ["notes", "body", "snippet", "total_eur", "unit_price", "normalized_eur", "payment_terms"]) {
    assert.equal(loader.includes(forbidden), false, "il loader non deve leggere " + forbidden);
  }
  assert.match(loader, /\.eq\("organization_id", organizationId\)/);
});

test("pagina: elenco trattative come predefinito, con ritorno alla vista precedente", () => {
  const page = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
  assert.match(page, /COMM_DEALS_DESK_ENABLED !== "0"/);
  assert.match(page, /params\.experience !== "classic"/);
  assert.match(page, /<CommercialDealsDesk /);
  const desk = readFileSync(new URL("../components/commercial-deals-desk.tsx", import.meta.url), "utf8");
  // COMM-CLIENTS1: «Richieste d'offerta», solo vendite.
  for (const header of ["Richiesta", "Cliente · materiale", "Fase", "Prossima azione"]) assert.ok(desk.includes(header));
  assert.match(page, /segment: "sales" as const/);
  // L'assistente resta sulla pagina, chiuso per non spingere giù la tabella.
  assert.match(desk, /<details id="commercial-assistant"/);
  assert.doesNotMatch(desk, /<details id="commercial-assistant"[^>]*\bopen\b/);
  // Il vecchio ancoraggio della sidebar e della dashboard continua a puntare alla lista.
  assert.match(desk, /id="commercial-worklist"/);
});

// COMM-DEALS2 — priorità su tutte le trattative con public.comm_deals2_index.

test("indice SQL: contratto verificato, chiavi coerenti, conteggi numerici", () => {
  const good = {
    contract: "comm-deals2-v1", total: 3,
    keys: [{ key: "campaign:" + id(10), kind: "campaign", id: id(10) }, { key: "inbound-rfq:" + id(1), kind: "inbound-rfq", id: id(1) }],
    counts: { segments: { all: 3, sales: 1, purchase: 2 }, filters: { todo: 1, waiting: 1, due: 0, drafts: 1, closed: 0 } },
  };
  const parsed = parseDealIndex(good);
  assert.equal(parsed.total, 3);
  assert.deepEqual(parsed.keys.map((k) => k.key), ["campaign:" + id(10), "inbound-rfq:" + id(1)]);
  assert.equal(parsed.counts.filters.drafts, 1);
  assert.equal(parseDealIndex({ ...good, contract: "other" }), null);
  assert.equal(parseDealIndex({ ...good, keys: [{ key: "campaign:" + id(1), kind: "inbound-rfq", id: id(1) }] }), null);
  assert.equal(parseDealIndex({ ...good, keys: [{ key: "quote:x", kind: "quote", id: "x" }] }), null);
  assert.equal(parseDealIndex(null), null);
});

test("ripiego sulla finestra: stessa pagina, stessi conteggi del modello", () => {
  const deals = salesDealsFromRows([
    { id: id(60), status: "new", created_at: "2026-11-16T10:00:00Z", company: { name: "A" } },
    { id: id(61), status: "quoted", created_at: "2026-11-15T10:00:00Z", company: { name: "B" } },
    { id: id(62), status: "new", created_at: "2026-11-14T10:00:00Z", company: { name: "C" } },
  ], [], [], routes);
  const view = pageFromDeals(deals, parseDealDeskState({ p: "2" }), 2, NOW);
  assert.equal(view.total, 3);
  assert.equal(view.pages, 2);
  assert.deepEqual(view.rows.map((d) => d.counterparty), ["B"]);
  assert.equal(pageFromDeals(deals, parseDealDeskState({ p: "9" }), 2, NOW).page, 2);
  assert.deepEqual(view.counts, countDeals(deals, "all", NOW));
});

test("migrazione: sola lettura, RLS del chiamante, non eseguibile da anon", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261117120000_comm_deals2_priority_index.sql", import.meta.url), "utf8");
  assert.match(sql, /security invoker/);
  assert.doesNotMatch(sql, /security definer/);
  assert.match(sql, /\bstable\b/);
  assert.match(sql, /revoke all on function public\.comm_deals2_index[^;]*from public, anon/);
  for (const forbidden of ["insert into", "update public", "delete from", "notes", "total_eur", "unit_price", "body"]) {
    assert.equal(sql.toLowerCase().includes(forbidden), false, "la funzione non deve contenere " + forbidden);
  }
  const loader = readFileSync(new URL("../lib/commercial-deals.ts", import.meta.url), "utf8");
  assert.match(loader, /rpc\("comm_deals2_index"/);
  assert.match(loader, /loadFromWindow/);
});
