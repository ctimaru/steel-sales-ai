import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const navigation = fs.readFileSync(
  new URL("../components/platform-navigation.tsx", import.meta.url),
  "utf8",
);
const routes = fs.readFileSync(
  new URL("../lib/routes.ts", import.meta.url),
  "utf8",
);
const contract = fs.readFileSync(
  new URL("../lib/platform-access-contract.ts", import.meta.url),
  "utf8",
);
const labsPage = fs.readFileSync(
  new URL("../app/(platform)/platform/labs/page.tsx", import.meta.url),
  "utf8",
);

test("Platform adds an owner-only Prove & novità navigation group", () => {
  assert.match(navigation, /Prove & novità/);
  assert.match(navigation, /Listini in prova/);
  assert.match(navigation, /appRoutes\.platform\.labs/);
  assert.match(navigation, /staffEnabled: false/);
  assert.match(routes, /labs: "\/platform\/labs"/);
});

test("Platform labs route remains behind Platform Console access and root ownership", () => {
  assert.match(contract, /route: "\/platform\/labs"/);
  assert.match(contract, /permission: "platform\.console\.access"/);
  assert.match(labsPage, /requirePlatformSuperadmin\(\)/);
  assert.match(labsPage, /Owner only/);
});

test("Platform labs renders the real internal Padana structured list directly", () => {
  assert.match(labsPage, /31c762b0-2d20-480f-aa87-dd63e33db945/);
  assert.match(labsPage, /getPriceListExplorerVersion\(PADANA_PTC18_VERSION_ID, true\)/);
  assert.match(labsPage, /getPriceListExplorerItems\(PADANA_PTC18_VERSION_ID, true\)/);
  assert.match(labsPage, /<PublicPriceListExplorer/);
  assert.match(labsPage, /<PrivateDiscountProfilesPanel/);
  assert.match(labsPage, /nessuna route pubblica/);
});
