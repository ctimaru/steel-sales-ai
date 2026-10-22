import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../../supabase/migrations/20261022085100_dash_next1c4b_crm_relationship_ledger.sql");
const page = read("../app/(italian)/(workspace)/commercial/page.tsx");
const actions = read("../app/(italian)/(workspace)/commercial/relationship-ledger-actions.ts");
const model = read("../lib/commercial-relationship-ledger.ts");
const ui = read("../components/commercial-relationship-ledger.tsx");

test("C4B enforces one Network relationship per organization and immutable audit events", () => {
  assert.match(migration, /unique \(organization_id,network_company_id\)/);
  assert.match(migration, /foreign key\(relationship_id,organization_id\)/);
  assert.match(migration, /create trigger crm_c4b_created_audit/);
  assert.match(migration, /after insert on public\.crm_network_relationships/);
  assert.match(migration, /grant insert\(organization_id,network_company_id,created_by\)/);
  assert.match(migration, /grant insert\(relationship_id,organization_id,actor_user_id,event_type,note\)/);
  assert.match(migration, /event_type in \('note','call','meeting','follow_up'\)/);
  assert.doesNotMatch(migration, /create policy .* for update|create policy .* for delete/);
});

test("C4B reader and writer are tenant-scoped, with explicit entitlement and write role", () => {
  assert.match(migration, /crm_network_relationships enable row level security/);
  assert.match(migration, /crm_network_relationship_events enable row level security/);
  assert.match(migration, /om\.user_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /om\.status='active'/);
  assert.match(migration, /om\.role in \('admin','member'\)/);
  assert.match(migration, /private\.pa1_3_network_access_allowed_for\(organization_id\)/);
  assert.match(migration, /nc\.publication_status='published'/);
  assert.match(actions, /requireWorkspaceWriteRole\(\)/);
  assert.match(actions, /getCommercialNetworkContext\(context\.organizationId, companyId\)/);
});

test("C4B needs explicit confirmation, bounds note size, blocks duplicate relation", () => {
  assert.match(actions, /confirm_relationship/);
  assert.match(actions, /confirm_activity/);
  assert.match(actions, /note\.length < 1 \|\| note\.length > 1200/);
  assert.match(actions, /ignoreDuplicates: true/);
  assert.match(actions, /organizationId !== context\.organizationId/);
  assert.match(actions, /networkCompanyId !== companyId/);
  assert.match(ui, /name="confirm_relationship"/);
  assert.match(ui, /name="confirm_activity"/);
  assert.match(ui, /maxLength=\{1200\}/);
  assert.match(ui, /Registra attività/);
});

test("C4B is a compact, lazily loaded Commerciale-only workspace with bounded history", () => {
  assert.match(model, /\.limit\(15\)/);
  assert.match(model, /\.limit\(20\)/);
  assert.match(model, /\.eq\("organization_id", organizationId\)/);
  assert.match(page, /showRelationships = networkAvailable && params\.relationships === "1"/);
  assert.match(page, /listCommercialOrganizationRelationships\(context\.organizationId\)/);
  assert.match(page, /<CommercialRelationshipLedger/);
  assert.match(ui, /data-testid="commercial-relationship-ledger"/);
  assert.match(ui, /canWrite \? \(/);
  assert.match(ui, /min-h-10/);
});
