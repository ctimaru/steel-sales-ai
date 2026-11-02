import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const activationCta = fs.readFileSync(
  new URL("../components/network-activation-cta.tsx", import.meta.url), "utf8"
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/network/actions.ts", import.meta.url),
  "utf8",
);
const profile = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url),
  "utf8",
);
const claimPage = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/claim/page.tsx", import.meta.url),
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

test("P4.1 Network profile exposes save/remove controls while preserving governed claim semantics", () => {
  assert.doesNotMatch(profile, /Salva azienda|Rimuovi dai salvati/);
  assert.match(profile, />\n\s*Connetti\n\s*<\/Link>/); // NET-UX LOT1: CTA renamed
  assert.match(profile, /NetworkActivationCta mode="published"/);
  assert.match(activationCta, /Rivendica il profilo/);
  assert.match(activationCta, /\/claim"/);
  assert.match(profile, /adminOrganizationId/);
  assert.match(claimPage, /requestNetworkClaim/);
});

// NET-UX LOT1B (founder decision 2 Nov 2026): a private list each user keeps to work
// on later; from it the user can open profiles, connect or prepare an RFQ.
test("NET-UX LOT1B saved companies page is a private working list", () => {
  assert.match(savedPage, /Aziende salvate/);
  assert.match(savedPage, /la vedi solo tu/);
  assert.match(savedPage, /getSavedNetworkCompanies\(context\.organizationId\)/);
  assert.match(savedPage, /<NetworkRfqSelectionBar /);
  assert.match(savedPage, /form="network-rfq-selection" name="supplier"/);
  assert.match(savedPage, /<NetworkSaveToggle /);
  assert.match(networkLib, /getSavedNetworkCompanies/);
});
