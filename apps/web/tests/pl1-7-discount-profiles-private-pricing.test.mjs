import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const explorer = fs.readFileSync(
  new URL("../components/public-price-list-explorer.tsx", import.meta.url),
  "utf8",
);
const panel = fs.readFileSync(
  new URL("../components/private-discount-profiles-panel.tsx", import.meta.url),
  "utf8",
);
const detail = fs.readFileSync(
  new URL("../app/(public)/listini/[versionId]/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(public)/listini/[versionId]/actions.ts", import.meta.url),
  "utf8",
);
const server = fs.readFileSync(
  new URL("../lib/price-list-explorer-server.ts", import.meta.url),
  "utf8",
);
const contract = fs.readFileSync(
  new URL("../lib/private-pricing.ts", import.meta.url),
  "utf8",
);

test("PL1.7 keeps anonymous manual pricing while offering authenticated private profiles", () => {
  assert.match(panel, /Accedi per salvare un profilo sconto|Accedi/);
  assert.match(panel, /Il calcolo manuale resta pubblico/);
  assert.match(explorer, /Sconto temporaneo · non viene salvato/);
  assert.match(detail, /getPrivatePricingContext/);
  assert.match(detail, /privatePricing=\{privatePricing\}/);
});

test("PL1.7 loads private pricing only from authenticated tenant context", () => {
  assert.match(server, /supabase\.auth\.getUser\(\)/);
  assert.match(server, /organization_memberships/);
  assert.match(server, /\.eq\("user_id", user\.id\)/);
  assert.match(server, /pl1_discount_profiles_for_version/);
  assert.match(server, /pl1_effective_discounts_for_version/);
  assert.match(server, /membership\.role === "admin" \|\| membership\.role === "member"/);
  assert.match(server, /membership\.role === "admin"/);
});

test("PL1.7 exposes high-frequency private discount scopes and organization visibility only to admins", () => {
  assert.match(panel, /value="manufacturer"/);
  assert.match(panel, /value="price_list"/);
  assert.match(panel, /value="version"/);
  assert.match(panel, /value="grade"/);
  assert.match(panel, /value="finish"/);
  assert.match(panel, /value="grade_finish"/);
  assert.match(panel, /context\.canManageOrganization/);
  assert.match(panel, /value="organization"/);
  assert.match(contract, /"section"/);
  assert.match(contract, /"item"/);
});

test("PL1.7 applies effective saved discounts per row without changing the PL1.6 price formula", () => {
  assert.match(explorer, /effectiveDiscountByItem/);
  assert.match(explorer, /discountForRow/);
  assert.match(explorer, /pricingMode === "saved"/);
  assert.match(explorer, /base \* \(1 - discountPct \/ 100\) \+ extra/);
  assert.match(explorer, /Profili salvati/);
  assert.match(explorer, />Sconto</);
});

test("PL1.7 mutations stay server-side and do not accept organization identifiers from the client", () => {
  assert.match(actions, /^"use server";/);
  assert.match(actions, /pl1_save_discount_profile/);
  assert.match(actions, /pl1_deactivate_discount_profile/);
  assert.doesNotMatch(actions, /organizationId/);
  assert.match(actions, /supabase\.auth\.getUser\(\)/);
});
