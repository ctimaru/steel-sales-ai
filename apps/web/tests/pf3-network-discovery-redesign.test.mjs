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

test("PF3 exposes save follow and open actions directly in search results", () => {
  assert.match(directory, /saveNetworkCompany/);
  assert.match(directory, /removeSavedNetworkCompany/);
  assert.match(directory, /followNetworkCompany/);
  assert.match(directory, /unfollowNetworkCompany/);
  assert.match(directory, /Salva/);
  assert.match(directory, /Segui/);
  assert.match(directory, /Apri/);
  assert.match(directory, /return_to/);
});

test("PF3 preserves directory filters after interaction actions", () => {
  assert.match(actions, /safeNetworkReturnPath/);
  assert.match(actions, /withNetworkFlash/);
  assert.match(actions, /returnTo/);
  assert.match(actions, /revalidatePath\("\/network"\)/);
  assert.match(actions, /network_directory/);
});

test("PF3 shows saved and followed counts without duplicating the full Network navigation", () => {
  assert.match(directory, /Salvate · \{saved\.length\}/);
  assert.match(directory, /Seguite · \{followed\.total\}/);
  assert.doesNotMatch(directory, />Activity</);
  assert.doesNotMatch(directory, />Inquiry</);
});
