import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/opportunities/[id]/page.tsx", import.meta.url),
  "utf8",
);
const data = fs.readFileSync(new URL("../lib/marketplace.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260929134500_p5_3_entitlement_unlock_foundation.sql", import.meta.url),
  "utf8",
);

test("P5.3 frontend resolves entitlement server-side before rendering locked detail", () => {
  assert.match(page, /getMarketplaceEntitlementState/);
  assert.match(page, /getMarketplaceUnlockedDetail/);
  assert.match(page, /entitlement\.state === "entitled"/);
  assert.match(page, /entitlement\.state === "expired"/);
  assert.match(page, /P5\.3 · Entitled detail/);
  assert.match(page, /P5\.3 · Locked detail/);
  assert.match(page, /Entitlement richiesto/);
});

test("P5.3 frontend never offers client-side self-grant or response rights", () => {
  assert.match(page, /Il supplier non può auto-concedersi accesso dal client/);
  assert.match(page, /Unlock ≠ diritto di risposta/);
  assert.match(page, /P5\.4/);
  assert.doesNotMatch(page, /grantMarketplace|p5_3_grant_entitlement/);
  assert.doesNotMatch(page, /Invia offerta|Rispondi ora|Submit quote/i);
});

test("P5.3 unlocked UI exposes structured opportunity detail and protects anonymous notes", () => {
  for (const field of [
    "standard_code",
    "grade_designation",
    "outer_diameter_mm",
    "thickness_mm",
    "length_mm",
    "quantity",
    "certification",
    "delivery_region",
    "requested_delivery_date",
  ]) {
    assert.match(page, new RegExp(`line\\.${field}`));
  }
  assert.match(page, /notes_withheld_for_anonymity/);
  assert.match(page, /Le note libere sono trattenute per proteggere l’anonimato/);
});

test("P5.3 web data layer only consumes governed entitlement/detail RPCs", () => {
  assert.match(data, /p5_3_entitlement_state/);
  assert.match(data, /p5_3_marketplace_detail/);
  assert.match(data, /p_supplier_organization_id/);
  assert.match(data, /error\.code === "42501"/);
  assert.doesNotMatch(data, /\.from\("marketplace_entitlement_events"\)/);
  assert.doesNotMatch(data, /\.from\("marketplace_unlocks"\)/);
});

test("P5.3 database creates append-only provider-neutral entitlement and unlock ledgers", () => {
  assert.match(migration, /create table public\.marketplace_entitlement_events/);
  assert.match(migration, /create table public\.marketplace_unlocks/);
  assert.match(migration, /marketplace_access/);
  assert.match(migration, /opportunity_unlock/);
  assert.match(migration, /subscription/);
  assert.match(migration, /credit/);
  assert.match(migration, /idempotency_key/);
  assert.match(migration, /append-only/);
  assert.match(migration, /unique\(request_id,supplier_organization_id\)/);
});

test("P5.3 grant/revoke authority cannot be self-issued by a supplier", () => {
  assert.match(migration, /private\.p5_3_require_entitlement_authority/);
  assert.match(migration, /private\.is_platform_superadmin\(\)/);
  assert.match(migration, /v_role='service_role'/);
  assert.match(migration, /Marketplace entitlement authority required/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all on function public\.p5_3_grant_entitlement/);
});

test("P5.3 entitlement state is locked entitled or expired and never grants response", () => {
  assert.match(migration, /'state','locked'/);
  assert.match(migration, /'state','entitled'/);
  assert.match(migration, /'state','expired'/);
  assert.match(migration, /'can_view_locked_detail',true/);
  assert.match(migration, /'can_respond',false/);
  assert.match(migration, /r\.organization_id<>p_supplier_organization_id/);
});

test("P5.3 anonymous unlocked detail withholds buyer identity title and free-text notes", () => {
  assert.match(migration, /v_teaser->'buyer'/);
  assert.match(migration, /case when v_request\.visibility_mode='named' then l\.notes else null end/);
  assert.match(migration, /'notes_withheld_for_anonymity',v_request\.visibility_mode='anonymous'/);
  assert.doesNotMatch(migration, /'title',v_request\.title/);
  assert.doesNotMatch(migration, /'organization_id',v_request\.organization_id/);
});

test("P5.3 detail access is audited but remains read-only with respect to P5.4", () => {
  assert.match(migration, /insert into public\.marketplace_unlocks/);
  assert.match(migration, /on conflict\(request_id,supplier_organization_id\) do nothing/);
  assert.match(migration, /P5\.3-detail-v1/);
  assert.match(migration, /'can_respond',false/);
  assert.doesNotMatch(migration, /marketplace_responses|submit_quote|create_response/i);
});
