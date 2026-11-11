import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../../supabase/migrations/20261111135000_netprofile_ux1b_inventory.sql");
const sqlTests = read("../../../supabase/tests/netprofile_ux1b_inventory.sql");
const reader = read("../lib/network-stock.ts");
const publicCard = read("../components/network-profile-inventory.tsx");
const manager = read("../components/network-inventory-manager.tsx");
const actions = read("../app/(italian)/(workspace)/network/actions.ts");
const canonical = read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const free = read("../components/free-network-profile.tsx");
const manage = read("../app/(italian)/(workspace)/network/manage/page.tsx");
const workflow = read("../../../.github/workflows/p0-required-gate.yml");

test("NET-PROFILE-UX1.B: inventory is private and company declared", () => {
  assert.match(migration, /create table if not exists private\.netprofile_ux1b_inventory/);
  assert.match(migration, /alter table private\.netprofile_ux1b_inventory enable row level security/);
  assert.match(migration, /revoke all on private\.netprofile_ux1b_inventory from public,anon,authenticated/);
  assert.match(migration, /check \(provenance = 'company_declared'\)/);
  assert.match(migration, /check \(publication_status in \('draft','published','archived'\)\)/);
  assert.match(migration, /available_on is not null/);
  assert.match(migration, /private\.netprofile_ux1b_events/);
  assert.match(migration, /insert into private\.netprofile_ux1b_events/);
  assert.doesNotMatch(migration, /grant select on private\.netprofile_ux1b_inventory to anon|grant select on private\.netprofile_ux1b_inventory to authenticated/i);
});

test("NET-PROFILE-UX1.B: public inventory is published-only and claim-gated", () => {
  assert.match(migration, /private\.netux11_require_active_company\(p_org\)/);
  assert.match(migration, /private\.m7_user_can_manage_network_company/);
  assert.match(migration, /om\.organization_id=p_org/);
  assert.match(migration, /cl\.status='approved'/);
  assert.match(migration, /publication_status='published'/);
  assert.match(migration, /provenance text not null default/);
  assert.match(migration, /security invoker set search_path=''/);
  assert.match(migration, /revoke all on function public\.netprofile_ux1b_public\(uuid,uuid\) from public,anon/);
  assert.match(sqlTests, /has_table_privilege/);
  assert.match(sqlTests, /when sqlstate '42501'/);
  assert.match(workflow, /netprofile_ux1b_inventory\.sql/);
});

test("NET-PROFILE-UX1.B: public UI renders actual rows or nothing", () => {
  assert.match(reader, /supabase\.rpc\("netprofile_ux1b_public"/);
  assert.match(reader, /if \(error\?\.code === "PGRST202"/);
  assert.match(reader, /provenance: "company_declared"/);
  assert.match(publicCard, /if \(!items\.length\) return null/);
  assert.match(publicCard, /Stock, magazzino e programmazione/);
  assert.match(publicCard, /item\.quantity/);
  assert.match(publicCard, /Aggiornato:/);
  assert.match(publicCard, /soggette a conferma/);
  assert.match(canonical, /<NetworkProfileInventory items=\{publishedInventory\}/);
  assert.match(free, /provisional \? \[\] : await getPublishedNetworkInventory/);
  assert.match(free, /<NetworkProfileInventory items=\{inventory\}/);
  assert.doesNotMatch(publicCard, /example\.com|12 t|40 t|Dato stimato/);
});

test("NET-PROFILE-UX1.B: only approved admins can draft, publish and archive", () => {
  assert.match(manage, /<NetworkInventoryManager/);
  assert.match(manage, /getManagedNetworkInventory/);
  assert.match(manager, /action=\{saveManagedNetworkInventory\}/);
  assert.match(manager, /value="draft"/);
  assert.match(manager, /value="published"/);
  assert.match(manager, /value="archived"/);
  assert.match(manager, /!inventory\.ready/);
  assert.match(actions, /export async function saveManagedNetworkInventory/);
  assert.match(actions, /const context = await requireWorkspaceAdmin\(\)/);
  assert.match(actions, /p_organization_id: context\.organizationId/);
  assert.match(actions, /supabase\.rpc\("netprofile_ux1b_upsert"/);
  assert.match(migration, /approved company claim and active admin membership required/);
});

test("NET-PROFILE-UX1.B: ISO dates really pass the server-action validator", () => {
  const expression = actions.match(/&& !\/(\^[^/]+\$)\/\.test\(date\)/);
  assert.ok(expression, "find exact server action date regex, do not use a duplicate helper");
  const validator = new RegExp(expression[1]);
  assert.equal(validator.test("2026-12-01"), true, "future arrivals accept yyyy-mm-dd");
  assert.equal(validator.test("2027-01-15"), true, "production dates accept yyyy-mm-dd");
  assert.equal(validator.test("01/12/2026"), false, "localized date rejected");
  assert.equal(validator.test("tomorrow"), false, "unparseable date rejected");
});


const draftGateMigration = read("../../../supabase/migrations/20261111150000_netprofile_ux1b_pending_review_drafts.sql");
const draftGateSqlTest = read("../../../supabase/tests/netprofile_ux1b_pending_drafts.sql");

test("NET-PROFILE-UX1.B2: reviewed company can draft but cannot publish", () => {
  assert.match(draftGateMigration, /publication_status in \('published','pending_review'\)/);
  assert.match(draftGateMigration, /m7_user_can_manage_network_company/);
  assert.match(draftGateMigration, /if new\.publication_status='published' and not exists/);
  assert.match(draftGateMigration, /c\.publication_status='published'/);
  assert.match(draftGateMigration, /c\.archived_at is null/);
  assert.match(draftGateMigration, /before insert or update on private\.netprofile_ux1b_inventory/);
  assert.match(draftGateSqlTest, /Publication guard trigger must be enabled/);
  assert.match(workflow, /netprofile_ux1b_pending_drafts\.sql/);
  assert.match(manager, /disabled=\{!canPublish\}/);
  assert.match(manager, /data-testid="network-stock-publishing-wait"/);
  assert.match(manage, /canPublish=\{state\.company\.publication_status === "published"\}/);
});
