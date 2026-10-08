import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/(platform)/platform/steel-pulse/page.tsx");
const people = read("../app/(platform)/platform/people/page.tsx");
const migration = read("../../../supabase/migrations/20261008221500_sp71_steel_pulse_source_readiness.sql");
const acceptance = read("../../../supabase/tests/sp71_steel_pulse_editorial_readiness.sql");
const hp13 = read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");
const ci = read("../../../.github/workflows/p0-required-gate.yml");

test("SP7.1 page is owner-only and reads actual current production status", () => {
  assert.match(page, /requirePlatformConsoleContext/);
  assert.match(page, /!context\.is_platform_owner/);
  assert.match(page, /sp71_pilot_source_readiness/);
  assert.match(page, /validReadiness\(result\.data\)/);
  assert.match(page, /getPlatformStaffDirectory/);
  assert.match(page, /getPlatformStaffInvitations/);
  assert.match(page, /person\.status === "active"/);
  assert.match(page, /reviewer\.user_id !== author\.user_id/);
  assert.match(page, /non può essere considerata pronta/);
});

test("SP7.1 reuses audited invitations, no new unauthorized admin or publish controls", () => {
  assert.match(people, /href="\/platform\/steel-pulse"/);
  assert.match(people, /id="editorial-staff-invite"/);
  assert.match(people, /createPlatformStaffInvitation/);
  assert.match(page, /\/platform\/people#editorial-staff-invite/);
  assert.doesNotMatch(page, /insert\(|update\(|delete\(|set_source_status|publication_settings\.enabled=true/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
});

test("SP7.1 RPC narrows rights visibility to Platform Owner and changes no approvals", () => {
  assert.match(migration, /security definer set search_path=''/);
  assert.match(migration, /not private\.is_platform_superadmin\(\)/);
  assert.match(migration, /revoke all on function public\.sp71_pilot_source_readiness\(\)/);
  assert.match(migration, /grant execute on function public\.sp71_pilot_source_readiness\(\)/);
  assert.match(migration, /s\.reviewer_user_id<>s\.legal_reviewer_user_id/);
  assert.match(migration, /s\.approval_expires_at>now\(\)/);
  assert.doesNotMatch(migration, /update steel_pulse_private\.sources|insert into steel_pulse_private\.editorial_cards|create policy/i);
  assert.match(acceptance, /normal authenticated user was able to view source controls/);
  assert.match(acceptance, /pilot rights never auto-approve/);
  assert.match(acceptance, /public kill switch remains disabled/);
  assert.match(hp13, /'sp71_pilot_source_readiness'/);
  assert.match(ci, /sp71_steel_pulse_editorial_readiness\.sql/);
});
