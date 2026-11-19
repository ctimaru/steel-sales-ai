// COMM-CYCLE2.B pure commercial price rules + feature contracts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeQuoteLines, quoteEquivalentRate, quoteEstimatedTotal,
} from "../lib/comm-cycle2b-pricing.ts";

const id = "00000000-0000-4000-8000-000000000111";
const id2 = "00000000-0000-4000-8000-000000000222";
const line = (extra={}) => ({ line_id: id, rate: "1.250,50", unit: "EUR/t", weight: "15,42", ...extra });
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("parsed Italian customer €/t rate and declared kg/m, no supplier targets", () => {
  const x = normalizeQuoteLines([line(), line({ line_id: id2, rate: "", weight: "" })]);
  assert.equal(x.ok,true);
  assert.deepEqual(x.lines, [
    { line_id: id, price_value: 1250.5, price_unit: "EUR/t", weight_kg_m: 15.42 },
    { line_id: id2, price_value: null, price_unit: null, weight_kg_m: null },
  ]);
});

test("invalid or duplicate lines rejected, never silently normalised", () => {
  assert.equal(normalizeQuoteLines([line(),line()]).ok,false);
  assert.equal(normalizeQuoteLines([line({ weight: "-2" })]).ok,false);
  assert.equal(normalizeQuoteLines([line({ rate: "12.foo" })]).ok,false);
  assert.equal(normalizeQuoteLines([line({ rate: "0" })]).ok,false);
  assert.equal(normalizeQuoteLines([line({ unit: "USD/m" })]).ok,false);
});

test("bidirectional commercial conversion only with verified kg/m", () => {
  assert.ok(Math.abs(quoteEquivalentRate("1000","EUR/t","15,42")-15.42)<1e-9);
  assert.ok(Math.abs(quoteEquivalentRate("15,42","EUR/m","15,42")-1000)<1e-9);
  assert.equal(quoteEquivalentRate("1000","EUR/t",""),null);
});

test("quote total uses requested units or traceable weight, never guesses pieces", () => {
  assert.equal(quoteEstimatedTotal("1000","EUR/t",10,"t",""),10000);
  assert.equal(quoteEstimatedTotal("27","EUR/m",100,"m",""),2700);
  assert.ok(Math.abs(quoteEstimatedTotal("1000","EUR/t",100,"m","15,42")-1542)<1e-8);
  assert.equal(quoteEstimatedTotal("1000","EUR/t",100,"m",""),null);
  assert.equal(quoteEstimatedTotal("1000","EUR/t",20,"pz","15,42"),null);
});

test("editor security, form, no automatic dispatch; 390px grid is responsive", () => {
  const migration=read("../../../supabase/migrations/20261119201000_comm_cycle2b_offer_editor.sql");
  const action=read("../app/(italian)/(workspace)/commercial/cycle2b-actions.ts");
  const editor=read("../components/commercial-customer-offer-editor.tsx");
  const request=read("../app/(italian)/(workspace)/rfqs/[id]/page.tsx");
  const gate=read("../../../.github/workflows/p0-required-gate.yml");
  const hp13=read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");
  assert.match(migration,/public\.comm_cycle2b_save_offer/);
  assert.match(migration,/p_expected_version <> v_offer\.draft_edit_version/);
  assert.match(migration,/private\.office_write_denied\(p_organization_id,'commercial'\)/);
  assert.match(migration,/offer_edited/);
  assert.match(migration,/comm_cycle2b_send_readiness/);
  assert.match(action,/canWriteWorkspace/);
  assert.match(action,/normalizeQuoteLines/);
  assert.match(editor,/sm:grid-cols-2/);
  assert.match(editor,/lg:grid-cols-/);
  assert.match(editor,/Salva bozza/);
  assert.match(editor,/quoteEquivalentRate/);
  assert.match(request,/CommercialCustomerOfferPanel/);
  assert.match(gate,/comm_cycle2b_offer_editor\.sql/);
  assert.match(hp13,/comm_cycle2b_save_offer/);
  assert.doesNotMatch(editor,/sendEmail|sendMail|service_role/i);
});
