import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const { readFileSync } = fs;

const home = fs.readFileSync(
  new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url),
  "utf8",
);

test("PF1 turns Home into a compact daily cockpit", () => {
  // HOME-FOCUS1 (founder decision, 4 Nov 2026): the Home RFQ box and the "Cosa richiede attenzione" strip were removed; superseded checks rewritten.
  assert.doesNotMatch(home, /Cosa richiede attenzione|Solo segnali con un’azione concreta/);
  assert.match(home, /Ultimi movimenti commerciali/);
});

test("PF1 keeps setup contextual and only when incomplete", () => {
  const checklist = readFileSync(new URL("../components/workspace-first-run-checklist.tsx", import.meta.url), "utf8");
  assert.match(home, /<WorkspaceFirstRunChecklist state=\{firstRun\}/);
  assert.match(checklist, /Continua setup/);
  assert.match(checklist, /essentialCompleted/);
});

test("PF1 provides four concrete quick actions", () => {
  // HOME-FEED1 (founder decision, 4 Nov 2026): Home is a three-column feed; superseded layout checks rewritten.
  assert.doesNotMatch(home, /<HomeAiComposer/); // HOME-FOCUS1 (founder decision, 4 Nov 2026): the Home RFQ box and the "Cosa richiede attenzione" strip were removed; superseded checks rewritten.
  assert.match(home, /Crea distinta/);
  assert.match(home, /\{firstRun \? "Crea la tua prima RFQ" : "Crea una RFQ"\}/);
});

test("PF1 removes duplicated macro-section marketing from Home", () => {
  assert.doesNotMatch(home, /Ecosistema Smart Steel Sales/);
  assert.doesNotMatch(home, /Spazi condivisi/);
  assert.doesNotMatch(home, /Operations e configurazione/);
  assert.doesNotMatch(home, /Memoria commerciale privata/);
});

test("PF1 reduces Home data loading to cockpit signals", () => {
  assert.doesNotMatch(home, /getFollowedNetworkCompanies/);
  assert.doesNotMatch(home, /getSavedNetworkCompanies/);
  assert.doesNotMatch(home, /getNetworkInquiries\(context\.organizationId, "sent"\)/);
  assert.doesNotMatch(home, /getNetworkInquiries/); // NET-UX LOT1B: Network inquiries retired; requests go through the RFQ Hub
  assert.doesNotMatch(home, /getNetworkActivityFeed/);
});
