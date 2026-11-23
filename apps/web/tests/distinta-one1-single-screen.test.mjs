import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { legacyComposeRedirect, newRequestHref } from "../lib/new-request-href.ts";

// DISTINTA-ONE1 (founder decision, 17 Nov 2026): one address to create a request,
// chat + Distinta on the same screen, no direct email send of the bill.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const UUID = "0c7a4c2e-6a55-4a9f-8f0b-6a3f3d2b1c0a";

test("one address: every entry point builds /rfq-hub/distinta", () => {
  assert.equal(newRequestHref(), "/rfq-hub/distinta");
  assert.equal(newRequestHref({ measure: true }), "/rfq-hub/distinta?aggiungi=misura");
  assert.equal(newRequestHref({ network: UUID, measure: true }), "/rfq-hub/distinta?aggiungi=misura&network=" + UUID);
  assert.equal(newRequestHref({ network: "not-a-uuid" }), "/rfq-hub/distinta", "Invalid Network ids are dropped");
  assert.equal(newRequestHref({ fromNetwork: true }), "/rfq-hub/distinta?source=network");
});

test("old /commercial?compose=1 links redirect to the same screen", () => {
  assert.equal(legacyComposeRedirect({ method: "ai" }), "/rfq-hub/distinta");
  assert.equal(legacyComposeRedirect({}), "/rfq-hub/distinta?aggiungi=misura");
  assert.equal(legacyComposeRedirect({ network: UUID }), "/rfq-hub/distinta?aggiungi=misura&network=" + UUID);
  assert.equal(legacyComposeRedirect({ method: "ai", source: "network" }), "/rfq-hub/distinta?source=network");
  const commercial = read("../app/(italian)/(workspace)/commercial/page.tsx");
  assert.match(commercial, /if \(params\.compose === "1"\) redirect\(legacyComposeRedirect\(params\)\);/);
  assert.doesNotMatch(commercial, /<BuyerDistintaBuilder/);
});

test("no source file still links to the retired compose screen", () => {
  for (const file of [
    "../components/commercial-deals-desk.tsx", "../components/commercial-ai-native-shell.tsx",
    "../components/commercial-ai-companion.tsx", "../components/commercial-unified-worklist.tsx",
    "../components/network-rfq-bridge.tsx", "../components/dashboard-discovery-feed.tsx",
    "../lib/company-posts-model.ts", "../app/(italian)/(workspace)/dashboard/page.tsx",
    "../app/(italian)/(workspace)/network/conversation-actions.ts",
  ]) {
    assert.doesNotMatch(read(file), /compose=1/, file);
  }
});

test("the single screen: one box + Distinta, step 2 = suppliers", () => {
  const page = read("../app/(italian)/(workspace)/rfq-hub/distinta/page.tsx");
  assert.match(page, /requireWorkspaceWriteRole/);
  assert.match(page, /focusAiIntake\n/);
  assert.match(page, /openMeasure=\{params\.aggiungi === "misura" \|\| locale !== "it"\}/);
  assert.match(page, /<RequestSteps current=\{0\}/);
  assert.match(read("../components/request-steps.tsx"), /"Cosa ti serve", "A chi lo chiedi", "Invia"/);
  // A Network company is provenance only, never an automatic recipient.
  assert.match(page, /non viene aggiunta in automatico/);
  const builder = read("../components/buyer-distinta-builder.tsx");
  // DISTINTA-SMART1: «aggiungi=misura» focuses the single box.
  assert.match(builder, /autoFocus=\{openMeasure \|\| Boolean\(quickAddPrefill\)\}/);
  assert.match(builder, /router\.push\(appRoutes\.rfqHub\.campaign\(result\.rfqId\)/);
  assert.doesNotMatch(builder, /returnToCommercial/);
  const sheet = read("../components/distinta-sheet.tsx");
  assert.match(sheet, /data-testid="distinta-choose-suppliers"/);
  assert.match(sheet, /Scegli i fornitori →/);
  // No second «aggiungi» entry point next to the Distinta.
  assert.doesNotMatch(sheet, /distinta-add-measure|Aggiungi riga libera|Aggiungi articolo/);
  assert.match(sheet, /l’invio parte solo dopo la tua conferma/);
});

test("no direct email send of the bill of material", () => {
  const builder = read("../components/buyer-distinta-builder.tsx");
  for (const gone of ["sendBuyerDistinta", "recipientInput", "Invia direttamente a più fornitori", "Email fornitori"]) {
    assert.equal(builder.includes(gone), false, gone);
  }
  const actions = read("../app/(italian)/(public)/distinta/actions.ts");
  assert.doesNotMatch(actions, /api\.resend\.com/);
  assert.match(actions, /export async function sendBuyerDistinta\(\n  _input: SendBuyerDistintaInput,\n\): Promise<\{ ok: boolean; sentCount\?: number; error\?: string \}> \{\n  return \{ ok: false,/);
});
