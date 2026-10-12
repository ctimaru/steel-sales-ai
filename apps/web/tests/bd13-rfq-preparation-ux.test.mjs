import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");
const dispatch = read("../components/rfq-dispatch-panel.tsx");

test("BD13: private preparation has explicit 1 select / 2 verify and send / optional Marketplace", () => {
  assert.match(page, /const isPreparation = campaign.status === "draft" \|\| campaign.status === "ready"/);
  assert.match(page, /1 · Scegli i fornitori/);
  assert.match(page, /2 · Verifica e invia/);
  assert.match(page, /Oppure usa il Marketplace/);
  const suppliers = page.indexOf("<RfqSupplierAddForm");
  const selected = page.indexOf('aria-label="Destinatari selezionati"');
  const send = page.indexOf("<RfqDispatchPanel");
  const market = page.indexOf("<RfqMarketplaceBridgePanel");
  assert.ok(suppliers > 0 && suppliers < selected && selected < send && send < market);
});

test("BD13: marketplace remains an explicitly opened, voluntary alternative, never auto-published", () => {
  assert.match(page, /id="rfq-marketplace-choice"/);
  assert.match(page, /<details id="rfq-marketplace-choice"/);
  assert.match(page, /Non viene pubblicata aprendo questa sezione/);
  assert.match(page, /RfqMarketplaceBridgePanel/);
  assert.match(page, /canExecute=\{canExecuteCritical\}/);
  assert.doesNotMatch(page, /publishRfqh8MarketplaceBridge\(/);
});

test("BD13: governance and advanced stages stay available without blocking first action with clutter", () => {
  assert.match(page, /Autorizzazioni e approvazioni aziendali/);
  assert.match(page, /Rfqh13GovernancePanel/);
  assert.match(page, /<details open=\{!isPreparation\}/);
  assert.match(page, /RfqQuoteComparison/);
  assert.match(page, /RfqBuyerNegotiationPanel/);
  assert.match(page, /Rfqh9PurchaseOrderPanel/);
  assert.match(page, /RfqAwardPanel/);
  assert.match(page, /Fasi successive · offerte, negoziazione e ordini/);
});

test("BD13: dispatch still requires an explicit real-send click and an owner with deliverable recipients", () => {
  assert.match(dispatch, /2 · Verifica e invia/);
  assert.match(dispatch, /onClick=\{launch\}/);
  assert.match(dispatch, /launchBuyerRfq\(/);
  assert.match(dispatch, /disabled=\{launchPending \|\| suppliers.length < 1 \|\| missingEmail > 0\}/);
  assert.match(dispatch, /canExecute/);
  assert.match(dispatch, /Nessuna email parte finché non premi/);
  assert.match(dispatch, /Riprova/);
  assert.match(dispatch, /Invia promemoria governato/);
});
