// COMM-RDO2 (19 nov 2026): righe di «Richieste d'offerta» leggibili.
// Prodotto dalle righe strutturate, cliente o «da collegare», fasi etichettate,
// date commerciali al posto di quelle di importazione, contrasto del contatore.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { productFromKey, productSummary } from "../lib/commercial-product-key.ts";
import { salesDealsFromRows, salesSearchQuery } from "../lib/commercial-deal-model.ts";

const routes = {
  rfq: (id) => "/commercial/rfqs/" + id, offer: (id) => "/commercial/offers/" + id,
  order: (id) => "/commercial/orders/" + id, campaign: (id) => "/rfq-hub/" + id,
  distinta: (id) => "/rfq-hub/distinte/" + id,
};
const id = (n) => "34b7ea86-2d34-4bba-bc2b-" + String(n).padStart(12, "0");
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("chiave prodotto: nome e norma leggibili, solo dati strutturati", () => {
  assert.deepEqual(productFromKey("tube:v1|family=square_tube|grade=s355j2h|standard=en10219|material=_|geom=80x80|t=10|process=_"),
    { name: "Tubo quadro 80×80×10", spec: "EN 10219 S355J2H" });
  assert.deepEqual(productFromKey("tube:v1|family=round_tube|grade=_|standard=_|material=_|geom=od:193.7|t=6.3|process=_"),
    { name: "Tubo tondo Ø193,7×6,3", spec: "" });
  assert.deepEqual(productFromKey("tube:v1|family=rectangular_tube|grade=s235jr|standard=_|material=_|geom=200x100|t=4|process=_"),
    { name: "Tubo rettangolare 200×100×4", spec: "S235JR" });
  assert.equal(productFromKey("Tubo con prezzo 1200 €/t"), null, "free text is never parsed");
  assert.equal(productFromKey(null), null);
  const many = productSummary([
    { canonical_product_key: "tube:v1|family=square_tube|grade=s235jr|standard=_|material=_|geom=150x150|t=5|process=_" },
    { canonical_product_key: "tube:v1|family=square_tube|grade=s235jr|standard=_|material=_|geom=150x150|t=6|process=_" },
    { canonical_product_key: "tube:v1|family=rectangular_tube|grade=s235jr|standard=_|material=_|geom=150x100|t=5|process=_" },
  ]);
  assert.deepEqual(many, { name: "Tubo quadro 150×150×5 e altri 2", spec: "S235JR" });
});

test("ordine diretto: prodotto, ORD-, cliente da collegare, fasi saltate, data dell'ordine", () => {
  const order = {
    id: id(1), status: "received", created_at: "2026-09-22T08:00:00Z", ordered_at: "2026-09-07T08:00:00Z",
    customer_order_ref: null, deal_label: null, company: null,
    lines: [{ quantity: 9, quantity_unit: "PZ", canonical_product_key: "tube:v1|family=square_tube|grade=s355j2h|standard=en10219|material=_|geom=80x80|t=10|process=_" }],
  };
  const [deal] = salesDealsFromRows([], [], [order], routes);
  assert.equal(deal.title, "Tubo quadro 80×80×10");
  assert.equal(deal.material, "EN 10219 S355J2H");
  assert.equal(deal.quantity, "9 pz");
  assert.equal(deal.counterparty, "", "no invented customer name");
  assert.match(deal.reference, /^ORD-34B7EA$/);
  assert.equal(deal.origin, "Ordine diretto");
  assert.equal(deal.since, "2026-09-07T08:00:00Z", "the order date, not the import date");
  assert.deepEqual(deal.steps.map((s) => [s.label, s.done, Boolean(s.skipped)]), [
    ["Richiesta", false, true], ["Offerta", false, true], ["Ordine", true, false], ["Consegna", false, false],
  ]);
  assert.equal(deal.action, "Conferma l'ordine");
});

test("richiesta senza azienda: si usa il contatto; la ricerca ORD-/OFF- trova l'indice RDO-", () => {
  const rfq = {
    id: id(2), status: "new", created_at: "2026-09-22T08:00:00Z", requested_at: "2026-09-07T08:00:00Z",
    company: null, contact: { full_name: "Mario Bianchi" }, lines: [], offers: [], orders: [],
  };
  const [deal] = salesDealsFromRows([rfq], [], [], routes);
  assert.equal(deal.counterparty, "Mario Bianchi");
  assert.match(deal.reference, /^RDO-/);
  assert.equal(salesSearchQuery("ord-34b7ea"), "RDO-34b7ea");
  assert.equal(salesSearchQuery("OFF-34B7EA tubo"), "RDO-34B7EA tubo");
  assert.equal(salesSearchQuery("Rossi"), "Rossi");
});

test("lista e menu: colonne chiare, date commerciali, contatore leggibile sul verde", () => {
  const desk = read("../components/commercial-deals-desk.tsx");
  assert.match(desk, /Cliente da collegare/);
  assert.match(desk, /sinceText\(deal, now\)/);
  assert.doesNotMatch(desk, /"Agg\. " \+ formatHubDate/, "import dates are not shown as activity");
  assert.match(desk, /<Steps deal=\{deal\} labelled \/>/);
  const deals = read("../lib/commercial-deals.ts");
  assert.match(deals, /lines:order_lines!order_lines_order_id_fkey/);
  assert.match(deals, /contact:contacts!rfqs_contact_id_fkey\(full_name\)/);
  assert.doesNotMatch(deals, /raw_spec_text|source_text|price_value|unit_price/);
  const shell = read("../components/workspace-commercial-director-shell.tsx");
  assert.match(shell, /<SalesAttentionCount onDark=\{current\} \/>/);
  assert.doesNotMatch(shell, /<span className="min-w-0 truncate">\{item\.label\}<\/span>/);
  for (const file of ["../components/sales-attention-count.tsx", "../components/purchasing-attention-count.tsx"]) {
    assert.match(read(file), /onDark \? "bg-\[#7a4d0e\] text-white/);
  }
});
