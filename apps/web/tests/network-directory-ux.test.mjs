import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const directory = fs.readFileSync(
  new URL("../app/(workspace)/network/page.tsx", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);

test("PF3 Network home starts with discovery instead of explanatory copy", () => {
  assert.match(directory, /Trova aziende steel/);
  assert.match(directory, /Ricerca aziende/);
  assert.match(directory, /Directory privata del Network/);
  assert.match(directory, /Commercial Memory resta separata/);
});

test("Network home does not duplicate contextual navigation with a CTA wall", () => {
  assert.doesNotMatch(directory, /P5 readiness/);
  assert.doesNotMatch(directory, />Activity</);
  assert.doesNotMatch(directory, />Seguite</);
  assert.doesNotMatch(directory, />Inquiry</);
  assert.doesNotMatch(directory, />Aziende salvate</);
  assert.doesNotMatch(directory, />Gestisci profilo azienda</);
  for (const label of ["Directory", "Salvate", "Seguite", "Activity", "Inquiry"]) {
    assert.match(shell, new RegExp(`label: "${label}"`));
  }
});

test("Network discovery starts simple and progressively reveals advanced filters", () => {
  assert.match(directory, /Nome o dominio/);
  assert.match(directory, /type="search"/);
  assert.match(directory, /<details/);
  assert.match(directory, /Filtri/);
  assert.match(directory, /ruolo, prodotto, capability, mercato e paese/);
  assert.match(directory, /Tutta la filiera/);
});

test("Network results use customer-facing language and restrained metadata", () => {
  assert.match(directory, /Profili industriali pubblicati nel Network/);
  assert.match(directory, /Nessuna azienda trovata/);
  assert.match(directory, /compactList\(company\.roles\)/);
  assert.match(directory, /compactList\(company\.products\)/);
  assert.match(directory, /compactList\(company\.capabilities\)/);
  for (const forbidden of ["Solo profili published", "pending review", "read model", "P5 readiness"]) {
    assert.doesNotMatch(directory, new RegExp(forbidden));
  }
});
