import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(new URL("../app/(workspace)/network/page.tsx", import.meta.url), "utf8");
const gate = fs.readFileSync(new URL("../components/network-access-gate.tsx", import.meta.url), "utf8");
const access = fs.readFileSync(new URL("../lib/network-access.ts", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/(workspace)/layout.tsx", import.meta.url), "utf8");
const nav = fs.readFileSync(new URL("../components/workspace-navigation.tsx", import.meta.url), "utf8");
const actions = fs.readFileSync(new URL("../app/(workspace)/network/actions.ts", import.meta.url), "utf8");
const claimPage = fs.readFileSync(new URL("../app/(workspace)/network/[id]/claim/page.tsx", import.meta.url), "utf8");
const profilePage = fs.readFileSync(new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261003172000_pa1_3_network_paid_entitlement_boundary.sql", import.meta.url),
  "utf8",
);

test("PA1.3 renders a commercial Network gate before rich directory queries", () => {
  assert.match(home, /getNetworkAccessState/);
  assert.match(home, /if \(!access\.can_access_network\)/);
  assert.match(home, /<NetworkAccessGate/);
  assert.ok(home.indexOf("!access.can_access_network") < home.indexOf("getNetworkTaxonomy()"));
  assert.match(gate, /Network · Privato/);
  assert.match(gate, /Modulo premium/);
  assert.match(gate, /non introduce un checkout fittizio/);
});

test("PA1.3 keeps Network visible but marks locked access in navigation", () => {
  assert.match(layout, /networkEntitled/);
  assert.match(nav, /locked: !networkEntitled/);
  assert.match(nav, /Premium/);
  assert.match(nav, /🔒/);
});

test("PA1.3 gates rich Network routes and actions but not company claim", () => {
  assert.match(profilePage, /await requireNetworkAccess\(\)/);
  assert.match(actions, /async function activeOrganizationId\(\)[\s\S]*await requireNetworkAccess\(\)/);
  assert.match(actions, /export async function submitNetworkInquiry[\s\S]*await requireNetworkAccess\(\)/);

  assert.doesNotMatch(claimPage, /requireNetworkAccess/);
  assert.match(claimPage, /getCompanyClaimExperience/);
  assert.match(actions, /export async function requestNetworkClaim/);
});

test("PA1.3 uses append-only organization product entitlements and restrictive RLS", () => {
  assert.match(migration, /create table public\.organization_product_entitlement_events/);
  assert.match(migration, /product_key='network_access'/);
  assert.match(migration, /append-only/);
  assert.match(migration, /as restrictive[\s\S]*for select[\s\S]*private\.pa1_3_current_network_access_allowed\(\)/i);
  assert.match(migration, /create policy pa1_3_network_saved_entitlement/);
});

test("PA1.3 protects privileged Network RPCs at the database boundary", () => {
  assert.match(migration, /create or replace function public\.p3_7c_public_company_profile/);
  assert.match(migration, /perform private\.pa1_3_require_current_network_access\(\)/);
  assert.match(migration, /create or replace function public\.p4_follow_company/);
  assert.match(migration, /perform private\.pa1_3_require_network_access\(p_organization_id\)/);
  assert.match(migration, /Network entitlement required/);
});

test("PA1.3 leaves billing provider-neutral", () => {
  assert.match(migration, /subscription','bundle','trial','pilot','manual','system/);
  assert.match(migration, /source_reference/);
  assert.match(migration, /idempotency_key/);
  assert.doesNotMatch(migration, /stripe/i);
  assert.doesNotMatch(gate, /€\s*\d/);
});
