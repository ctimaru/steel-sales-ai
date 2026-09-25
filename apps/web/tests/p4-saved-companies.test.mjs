import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/network/actions.ts", import.meta.url),
  "utf8",
);
const profile = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url),
  "utf8",
);
const savedPage = fs.readFileSync(
  new URL("../app/(workspace)/network/saved/page.tsx", import.meta.url),
  "utf8",
);
const networkLib = fs.readFileSync(
  new URL("../lib/network.ts", import.meta.url),
  "utf8",
);

test("P4.1 save company is a private user action backed by network_saved_companies", () => {
  assert.match(actions, /network_saved_companies/);
  assert.match(actions, /user_id: userId/);
  assert.match(actions, /organization_id: organizationId/);
  assert.match(actions, /network_company_id: companyId/);
});

test("P4.1 Network profile exposes save and remove controls without changing claim semantics", () => {
  assert.match(profile, /Salva azienda/);
  assert.match(profile, /Rimuovi dai salvati/);
  assert.match(profile, /requestNetworkClaim/);
  assert.match(profile, /adminOrganizationId/);
});

test("P4.1 saved companies page explicitly preserves private bookmark semantics", () => {
  assert.match(savedPage, /Aziende salvate/);
  assert.match(savedPage, /lista è privata/);
  assert.match(savedPage, /non equivale a follow, connection, inquiry o segnale pubblico/);
  assert.match(networkLib, /getSavedNetworkCompanies/);
});
