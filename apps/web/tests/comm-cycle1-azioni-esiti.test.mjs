// COMM-CYCLE1 (founder decisions, 19 Nov 2026): azioni ed esiti del ciclo
// commerciale. Regole pure (quali azioni offre una trattativa), modello (offerte
// scadute, fasi), e contratti statici: un'unica funzione SQL scrive, la UI la usa.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CLOSE_REASONS, closeReasonLabel, dealCycleActions, outcomeText, outcomesFromEvents } from "../lib/commercial-cycle.ts";
import { salesDealsFromRows } from "../lib/commercial-deal-model.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const routes = {
  rfq: (id) => "/commercial/rfqs/" + id, offer: (id) => "/commercial/offers/" + id,
  order: (id) => "/commercial/orders/" + id, campaign: (id) => "/rfq-hub/" + id,
  distinta: (id) => "/rfq-hub/distinte/" + id,
};
const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");

test("motivi di chiusura: gli otto decisi, con «Altro»", () => {
  assert.deepEqual(CLOSE_REASONS.map((r) => r.key), [
    "price", "lead_time", "material_unavailable", "no_response", "offer_expired",
    "cancelled_by_customer", "awarded_elsewhere", "other",
  ]);
  assert.equal(closeReasonLabel("lead_time"), "Tempi di consegna");
  assert.equal(outcomeText({ reason: "price", note: null, at: null }), "Non conclusa · Prezzo");
});

test("azioni: una principale per stato, chiusura solo se non c'è un ordine in corso", () => {
  const rfq = (status) => ({ id: id(1), status });
  const take = dealCycleActions({ rfq: rfq("new"), offer: null, order: null }, null);
  assert.equal(take.primary.action, "take_charge");
  assert.equal(take.canClose.recordKind, "rfq");

  const draft = dealCycleActions({ rfq: rfq("in_progress"), offer: { id: id(2), status: "draft", expired: false }, order: null }, null);
  assert.equal(draft.primary.action, "offer_sent");
  const sent = dealCycleActions({ rfq: rfq("quoted"), offer: { id: id(2), status: "sent", expired: true }, order: null }, null);
  assert.equal(sent.primary.action, "offer_accepted");
  const accepted = dealCycleActions({ rfq: rfq("quoted"), offer: { id: id(2), status: "accepted", expired: false }, order: null }, null);
  assert.equal(accepted.primary.action, "order_registered");
  assert.equal(accepted.primary.askOrderRef, true);

  const received = dealCycleActions({ rfq: rfq("quoted"), offer: null, order: { id: id(3), status: "received" } }, null);
  assert.equal(received.primary.action, "order_confirmed");
  assert.ok(received.canClose, "a received order can still be closed as lost");
  const confirmed = dealCycleActions({ rfq: rfq("quoted"), offer: null, order: { id: id(3), status: "confirmed" } }, null);
  assert.deepEqual([confirmed.primary.action, confirmed.primary.toStatus], ["order_status", "in_production"]);
  assert.equal(confirmed.secondary[0].toStatus, "delivered");
  assert.equal(confirmed.canClose, null, "no lost close with a confirmed order");

  const lost = dealCycleActions({ rfq: rfq("closed_lost"), offer: null, order: null }, { reason: "price", note: null, at: null });
  assert.equal(lost.reopen.action, "reopen");
  assert.equal(lost.primary, null);
  assert.equal(lost.canClose, null);
  const won = dealCycleActions({ rfq: rfq("closed_won"), offer: null, order: { id: id(3), status: "delivered" } }, null);
  assert.equal(won.primary, null);
  assert.equal(won.canClose, null);
});

test("esiti: vale l'ultima chiusura, una riapertura la annulla", () => {
  const map = outcomesFromEvents([
    { deal_kind: "inbound-rfq", deal_id: id(1), action: "reopen", created_at: "2026-11-19T10:00:00Z" },
    { deal_kind: "inbound-rfq", deal_id: id(1), action: "close_lost", reason: "price", created_at: "2026-11-18T10:00:00Z" },
    { deal_kind: "campaign", deal_id: id(5), action: "close_lost", reason: "no_response", note: " nota ", created_at: "2026-11-18T10:00:00Z" },
  ]);
  assert.equal(map.has("inbound-rfq:" + id(1)), false);
  assert.deepEqual(map.get("campaign:" + id(5)), { reason: "no_response", note: "nota", at: "2026-11-18T10:00:00Z" });
});

test("modello: offerta scaduta tocca a noi, fasi Richiesta · Trattativa · Offerta · Ordine, stato per le azioni", () => {
  const rfq = {
    id: id(1), status: "quoted", created_at: "2026-10-01T10:00:00Z", requested_at: "2026-10-01T10:00:00Z",
    company: { name: "Rossi" }, lines: [],
    offers: [{ id: id(2), status: "sent", created_at: "2026-10-02T10:00:00Z", valid_until: "2026-10-10" }],
    orders: [],
  };
  const [deal] = salesDealsFromRows([rfq], [], [], routes);
  assert.equal(deal.bucket, "todo");
  assert.equal(deal.action, "Offerta scaduta: rinnova o chiudi");
  assert.deepEqual(deal.steps.map((s) => s.label), ["Richiesta", "Trattativa", "Offerta", "Ordine"]);
  assert.deepEqual(deal.steps.map((s) => s.done), [true, true, true, false]);
  assert.deepEqual(deal.cycle, { rfq: { id: id(1), status: "quoted" }, offer: { id: id(2), status: "sent", expired: true }, order: null });
  const fresh = salesDealsFromRows([{ ...rfq, offers: [{ ...rfq.offers[0], valid_until: "2999-01-01" }] }], [], [], routes)[0];
  assert.equal(fresh.bucket, "waiting");
});

test("contratti: un'unica scrittura (funzione SQL), profilo d'ufficio, UI in vendite e nel Centro RFQ", () => {
  const migration = read("../../../supabase/migrations/20261119143000_comm_cycle1_actions_outcomes.sql");
  assert.match(migration, /security definer/);
  assert.match(migration, /public\.is_organization_member\(p_organization_id, true\)/);
  assert.match(migration, /private\.office_write_denied\(p_organization_id, v_area\)/);
  assert.match(migration, /revoke insert, update, delete on public\.comm_deal_events from authenticated/);
  assert.match(migration, /revoke all on function public\.comm_cycle1_apply\([^)]*\) from public, anon/);
  const index = read("../../../supabase/migrations/20261119143100_comm_cycle1_index.sql");
  assert.match(index, /s\.offer_status = 'sent' and s\.offer_valid_until is not null and s\.offer_valid_until < current_date then 'todo'/);
  const actions = read("../app/(italian)/(workspace)/commercial/cycle-actions.ts");
  assert.match(actions, /db\.rpc\("comm_cycle1_apply"/);
  assert.match(actions, /officeWriteDenied\(recordKind === "campaign" \? "purchasing" : "commercial"\)/);
  assert.doesNotMatch(actions, /from\("(rfqs|offers|orders|buyer_rfq_campaigns)"\)\.update/);
  const desk = read("../components/commercial-deals-desk.tsx");
  assert.match(desk, /<CommercialDealCycleActions \{\.\.\.cycle\}/);
  assert.match(desk, /key: "closed", label: "Archiviate"/);
  const campaign = read("../app/(italian)/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");
  assert.match(campaign, /label: "Chiudi senza aggiudicare"/);
  assert.match(campaign, /purchasingWrite && \(campaign\.status === "launched" \|\| campaign\.status === "collecting"\)/);
  const gate = read("../../../.github/workflows/p0-required-gate.yml");
  assert.match(gate, /comm_cycle1_actions\.sql/);
});
