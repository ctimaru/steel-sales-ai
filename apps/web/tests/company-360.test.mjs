import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const directory = fs.readFileSync(
  new URL("../app/(workspace)/customers/page.tsx", import.meta.url),
  "utf8",
);
const detail = fs.readFileSync(
  new URL("../app/(workspace)/customers/[companyId]/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/customers/actions.ts", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);

test("Company 360 uses normalized read-model RPCs", () => {
  assert.match(actions, /p1_company_directory/);
  assert.match(actions, /p1_company_360/);
  assert.match(actions, /organization_memberships/);
});

test("customer surfaces state deterministic verified-link policy", () => {
  assert.match(directory, /identità verificate/);
  assert.match(detail, /Solo relazioni deterministiche e verificate/);
  assert.match(detail, /rapporto Contact→Company non viene confermato/);
  assert.doesNotMatch(detail, /dominio.*attribuit|infer.*dominio/i);
});

test("Company 360 exposes commercial chain and provenance surfaces", () => {
  for (const label of ["Contatti", "Conversazioni", "Messaggi", "RFQ", "Offerte", "Ordini"]) {
    assert.match(detail, new RegExp(label));
  }
  assert.match(detail, /Prodotti collegati/);
  assert.match(detail, /Prezzi osservati/);
  assert.match(detail, /Timeline commerciale/);
  assert.match(detail, /Evidenza/);
});

test("customers are a primary navigation destination", () => {
  assert.match(shell, /href: "\/customers"/);
  assert.match(shell, /Aziende commerciali/);
});
