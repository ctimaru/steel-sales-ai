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

test("Network home explains the space before exposing controls", () => {
  assert.match(directory, /Trova aziende e costruisci relazioni nel settore steel/);
  assert.match(directory, /Commercial Memory della tua azienda resta privata e separata/);
  for (const label of ["Trova", "Ritrova e segui", "Contatta"]) {
    assert.match(directory, new RegExp(label));
  }
});

test("Network home does not duplicate contextual navigation with a CTA wall", () => {
  assert.doesNotMatch(directory, /P5 readiness/);
  assert.doesNotMatch(directory, />Activity</);
  assert.doesNotMatch(directory, />Seguite</);
  assert.doesNotMatch(directory, />Inquiry</);
  assert.doesNotMatch(directory, />Aziende salvate</);
  assert.doesNotMatch(directory, />Gestisci profilo azienda</);
  for (const label of ["Directory aziende", "Aziende salvate", "Aziende seguite", "Activity", "Inquiry B2B"]) {
    assert.match(shell, new RegExp(label));
  }
});

test("Network discovery starts simple and progressively reveals advanced filters", () => {
  assert.match(directory, /Nome azienda o dominio/);
  assert.match(directory, /<details/);
  assert.match(directory, /Filtri avanzati/);
  assert.match(directory, /ruolo, prodotto, capability, mercato e paese/);
  assert.match(directory, /Da dove vuoi partire/);
  assert.match(directory, /Tutta la filiera/);
});

test("Network results use customer-facing language and restrained metadata", () => {
  assert.match(directory, /Profili pubblici del Network/);
  assert.match(directory, /Nessuna azienda trovata/);
  assert.match(directory, /company\.roles\.slice\(0, 2\)/);
  assert.match(directory, /company\.products\.slice\(0, 2\)/);
  for (const forbidden of ["Solo profili published", "pending review", "read model", "P5 readiness"]) {
    assert.doesNotMatch(directory, new RegExp(forbidden));
  }
});
