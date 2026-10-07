import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const routes = read("../lib/routes.ts");
const nav = read("../components/platform-navigation.tsx");
const page = read("../app/(platform)/platform/fundraising/page.tsx");
const actions = read("../app/(platform)/platform/fundraising/actions.ts");
const readModel = read("../lib/investor-outreach.ts");
const pack = read("../lib/marketing-investor-outreach-pack.ts");
const migration = read("../../../supabase/migrations/20261007135353_mkt8_investor_outreach_data_room_operations.sql");

test("MKT8 adds an owner-only fundraising operations surface", () => {
  assert.match(routes, /fundraising: "\/platform\/fundraising"/);
  assert.match(nav, /label: "Fundraising"/);
  assert.match(page, /requirePlatformSuperadmin\(\)/);
  assert.match(page, /Investor Outreach & Data Room/);
});

test("MKT8 keeps fundraising records behind private schema and governed RPCs", () => {
  assert.match(migration, /investor_private\.investor_outreach_targets/);
  assert.match(migration, /investor_private\.investor_outreach_events/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table investor_private\.investor_outreach_targets from public, anon, authenticated/);
  assert.match(migration, /private\.is_platform_superadmin\(\)/);
  assert.match(migration, /public\.mkt8_investor_outreach_list/);
  assert.match(readModel, /mkt8_investor_outreach_list/);
});

test("MKT8 links outreach targets to the governed Investor Room rather than duplicating access", () => {
  assert.match(migration, /references public\.investor_business_plan_invites\(id\)/);
  assert.match(page, /getInvestorAccessInvites/);
  assert.match(page, /InvestorShareLink/);
  assert.match(page, /access_count/);
  assert.match(page, /last_accessed_at/);
});

test("MKT8 persists follow-up and audit events", () => {
  assert.match(actions, /mkt8_investor_outreach_target_upsert/);
  assert.match(actions, /mkt8_investor_outreach_log_event/);
  assert.match(actions, /mkt8_investor_outreach_archive/);
  assert.match(migration, /next_follow_up_at/);
  assert.match(migration, /stage_changed/);
  assert.match(migration, /data_room_granted/);
});

test("MKT8 outreach pack is copy-ready but does not send mail automatically", () => {
  assert.match(pack, /Warm intro/);
  assert.match(pack, /Cold outreach/);
  assert.match(pack, /Post-meeting follow-up/);
  assert.match(pack, /€1\.0M working Seed/);
  assert.doesNotMatch(actions, /resend|sendEmail|send_email/i);
});
