// COMM-REVIEW1 (25 nov 2026): gli ordini ricevuti da oltre 30 giorni e mai
// confermati escono da «Da fare» e vanno in «Da verificare». Stessa regola
// nell'indice SQL e nel modello; righe della lista con segnale di apertura.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  countDeals, DEAL_REVIEW_AFTER_DAYS, parseDealDeskState, parseDealIndex, salesDealsFromRows, sortDeals,
} from "../lib/commercial-deal-model.ts";

const routes = {
  rfq: (id) => "/commercial/rfqs/" + id, offer: (id) => "/commercial/offers/" + id,
  order: (id) => "/commercial/orders/" + id, campaign: (id) => "/rfq-hub/" + id,
  distinta: (id) => "/rfq-hub/distinte/" + id,
};
const id = (n) => "5c0e7a11-2d34-4bba-bc2b-" + String(n).padStart(12, "0");
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("ordine ricevuto: entro 30 giorni «Da fare», oltre «Da verificare»", () => {
  assert.equal(DEAL_REVIEW_AFTER_DAYS, 30);
  const deals = salesDealsFromRows([], [], [
    { id: id(1), status: "received", created_at: daysAgo(2), ordered_at: daysAgo(2) },
    { id: id(2), status: "received", created_at: daysAgo(45), ordered_at: daysAgo(60) },
    { id: id(3), status: "confirmed", created_at: daysAgo(90) },
  ], routes);
  const byId = Object.fromEntries(deals.map((d) => [d.id, d]));
  assert.equal(byId[id(1)].bucket, "todo");
  assert.equal(byId[id(1)].action, "Conferma l'ordine");
  assert.equal(byId[id(2)].bucket, "review");
  assert.equal(byId[id(2)].action, "Verifica: conferma o chiudi");
  assert.equal(byId[id(3)].bucket, "progress", "a confirmed order is never «review»");
  const counts = countDeals(deals, "sales");
  assert.equal(counts.filters.todo, 1);
  assert.equal(counts.filters.review, 1);
  assert.equal(counts.segments.sales, 3, "«Da verificare» is still open");
  // Senza filtro: da fare prima, poi in corso, poi da verificare.
  assert.deepEqual(sortDeals(deals).map((d) => d.id), [id(1), id(3), id(2)]);
});

test("filtro nell'URL e conteggio dall'indice SQL (compatibile con l'indice precedente)", () => {
  assert.equal(parseDealDeskState({ f: "review" }).filter, "review");
  const base = {
    contract: "comm-deals2-v1", total: 0, keys: [],
    counts: { segments: { all: 0, sales: 0, purchase: 0 }, filters: { todo: 1, waiting: 0, due: 0, drafts: 0, closed: 0 } },
  };
  assert.equal(parseDealIndex(base).counts.filters.review, 0, "old index without the count still parses");
  assert.equal(parseDealIndex({ ...base, counts: { ...base.counts, filters: { ...base.counts.filters, review: 22 } } }).counts.filters.review, 22);
});

test("migrazione: stessa regola a 30 giorni, sola lettura, non eseguibile da anon", () => {
  const sql = read("../../../supabase/migrations/20261125170000_comm_review1_stale_orders.sql");
  assert.match(sql, /now\(\) - interval '30 days' as review_before/);
  assert.match(sql, /when 'received' then case when s\.order_at < \(select review_before from params\) then 'review' else 'todo' end/);
  assert.match(sql, /p_filter in \('todo', 'waiting', 'due', 'drafts', 'review', 'closed'\)/);
  assert.match(sql, /'review', \(select count\(\*\) from in_segment where bucket = 'review'\)/);
  assert.match(sql, /'contract', 'comm-deals2-v1'/);
  assert.match(sql, /security invoker/);
  assert.doesNotMatch(sql, /security definer/);
  assert.match(sql, /revoke all on function public\.comm_deals2_index[^;]*from public, anon/);
  for (const forbidden of ["insert into", "update public", "delete from", "total_eur", "unit_price"]) {
    assert.equal(sql.toLowerCase().includes(forbidden), false, "la funzione non deve contenere " + forbidden);
  }
});

test("lista: filtro «Da verificare», righe con segnale di apertura e senza salto di pagina", () => {
  const desk = read("../components/commercial-deals-desk.tsx");
  assert.match(desk, /\{ key: "review", label: "Da verificare" \}/);
  assert.match(desk, /<CommercialDealRowPending \/>/);
  assert.match(desk, /dealDeskHref\(\{ \.\.\.keep, page, item: deal\.key \}, ""\)\} scroll=\{false\}/);
  assert.match(desk, /<CommercialDealDetailFocus targetId="commercial-detail"/);
  const pending = read("../components/commercial-deal-row-pending.tsx");
  assert.match(pending, /useLinkStatus/);
  assert.match(pending, /Apertura…/);
});
