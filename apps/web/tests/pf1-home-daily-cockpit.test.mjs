import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(
  new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url),
  "utf8",
);

test("PF1 turns Home into a compact daily cockpit", () => {
  assert.match(home, /Cosa richiede attenzione/);
  assert.match(home, /Ultimi movimenti commerciali/);
  assert.match(home, /Azioni rapide/);
  assert.match(home, /Solo segnali con un’azione concreta/);
});

test("PF1 keeps setup contextual and only when incomplete", () => {
  assert.match(home, /setupIncomplete/);
  assert.match(home, /Continua setup/);
  assert.match(home, /essential_completed_count/);
});

test("PF1 provides four concrete quick actions", () => {
  assert.match(home, /Cerca nello storico/);
  assert.match(home, /Crea distinta/);
  assert.match(home, /Apri RFQ Hub/);
  assert.match(home, /Trova azienda/);
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
  assert.match(home, /getNetworkInquiries\(context\.organizationId, "received"\)/);
  assert.match(home, /getNetworkActivityFeed/);
});
