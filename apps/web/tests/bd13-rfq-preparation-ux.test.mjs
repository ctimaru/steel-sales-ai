import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");
const dispatch = read("../components/rfq-dispatch-panel.tsx");

test("BD13: private preparation has explicit 1 select / 2 verify and send / optional Marketplace", () => {
  assert.match(page, /const isPreparation = campaign.status === "draft" \|\| campaign.status === "ready"/);
  // DISTINTA2: the owner of a draft gets one focused step-2 screen:
  // recipients picker -> explicit send confirmation -> optional Marketplace.
  const branch = page.slice(page.indexOf("if (isPreparation && canExecuteCritical) {"), page.indexOf("<Rfqc1ChatWorkspace"));
  assert.ok(branch.length > 0, "step-2 branch precedes the chat workspace");
  // DISTINTA-SMART2: one shared high-contrast stepper for the three steps.
  assert.match(branch, /<RequestSteps current=\{currentStep\} \/>/);
  assert.match(read("../components/request-steps.tsx"),
    /"Cosa ti serve", "A chi lo chiedi", "Invia"/);
  // DISTINTA3: step 3 (send) is its own screen once at least one recipient exists;
  // step 2 = picker + «Continua»; Marketplace is shown locked.
  assert.match(branch, /const sendStep = query\?\.passo === "invia"|sendStep && supplierRows.length > 0/);
  const step3 = branch.slice(branch.indexOf('data-testid="rfq-step3"'), branch.indexOf('data-testid="rfq-step2"'));
  assert.match(step3, /<RfqDispatchPanel/);
  assert.match(step3, /layout="side"/);
  assert.match(step3, /aria-label="Fornitori scelti"/);
  assert.doesNotMatch(step3, /<RfqSupplierPicker/);
  const step2 = branch.slice(branch.indexOf('data-testid="rfq-step2"'));
  assert.ok(step2.indexOf("<RfqSupplierPicker") > 0 && step2.indexOf("<RfqSupplierPicker") < step2.indexOf('data-testid="rfq-step2-marketplace-locked"'));
  assert.match(step2, /continueHref=\{step3Href\}/);
  assert.doesNotMatch(step2, /<RfqDispatchPanel/);
  assert.match(branch, /Pubblica nel Marketplace<\/span> · Presto disponibile/);
  assert.doesNotMatch(branch, /<RfqMarketplaceBridgePanel/);
  // Read-only viewers of a draft keep the previous layout.
  assert.match(page, /1 · Scegli i fornitori/);
  assert.match(page, /2 · Verifica e invia/);
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
