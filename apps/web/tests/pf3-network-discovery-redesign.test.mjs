import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const directory = fs.readFileSync(
  new URL("../app/(workspace)/network/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/network/actions.ts", import.meta.url),
  "utf8",
);

test("PF3 makes Network search-first and keeps technical filters progressive", () => {
  assert.match(directory, /Trova aziende steel/);
  assert.match(directory, /Ricerca aziende/);
  assert.match(directory, /Nome o dominio/);
  assert.match(directory, /type="search"/);
  assert.match(directory, /Filtri/);
  assert.match(directory, /ruolo, prodotto, capability, mercato e paese/);
});

test("PF3 keeps the steel supply-chain shortcuts compact", () => {
  for (const label of ["Tutta la filiera", "Produttori", "Commercianti", "Terzisti", "Utilizzatori"]) {
    assert.match(directory, new RegExp(label));
  }
  assert.match(directory, /companyTypeHref/);
});

test("PF3 renders dense industrial rows instead of oversized linked cards", () => {
  assert.match(directory, /Ruolo & prodotti/);
  assert.match(directory, /Capability/);
  assert.match(directory, /rivendicabile/i);
  assert.match(directory, /Verificata/);
  assert.match(directory, /compactList\(company\.roles\)/);
  assert.match(directory, /compactList\(company\.products\)/);
  assert.match(directory, /compactList\(company\.capabilities\)/);
  assert.doesNotMatch(directory, /grid gap-4 lg:grid-cols-2/);
});

test("NET-CONNECT1 replaces social actions with purposeful company links", () => {
  assert.doesNotMatch(directory, /saveNetworkCompany|followNetworkCompany|unfollowNetworkCompany|removeSavedNetworkCompany/);
  assert.match(directory, /appRoutes.network.connections/);
  assert.match(directory, /Connessioni aziendali/);
  assert.match(directory, /Esplora azienda/);
});

test("PF3 preserves directory filters after interaction actions", () => {
  assert.match(actions, /safeNetworkReturnPath/);
  assert.match(actions, /withNetworkFlash/);
  assert.match(actions, /returnTo/);
  assert.match(actions, /revalidatePath\("\/network"\)/);
  assert.match(actions, /network_directory/);
});

test("NET-CONNECT1 removes saved and followed counters from company exploration", () => {
  assert.doesNotMatch(directory, /Salvate · |Seguite · /);
  assert.match(directory, /Esplora aziende/);
  assert.doesNotMatch(directory, />Activity</);
  assert.doesNotMatch(directory, />Inquiry</);
});
