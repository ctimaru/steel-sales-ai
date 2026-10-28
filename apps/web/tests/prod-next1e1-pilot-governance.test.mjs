import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../../supabase/migrations/20261028190000_prod_next1e1_pilot_governance_privacy.sql");
const contract = read("../lib/pilot-activation-governance.ts");
const page = read("../app/(italian)/(platform)/platform/pilot/readiness/page.tsx");
const actions = read("../app/(italian)/(platform)/platform/pilot/readiness/actions.ts");
const existing = read("../app/(italian)/(platform)/platform/pilot/page.tsx");

test("PROD-NEXT1.E1 blocks legacy P5.6 activation in the database, not only in UI", () => {
  assert.match(migration, /create trigger prod_next1e_guard_activation[\s\S]+?on public\.marketplace_pilot_participants/);
  assert.match(migration, /before insert or update of status/);
  assert.match(migration, /enabled boolean not null default false/);
  assert.match(migration, /real company pilot not authorized/);
  assert.match(migration, /company admission not approved/);
  assert.match(existing, /Governance e 5 metriche/);
  assert.match(existing, /Attivazione bloccata/);
});

test("PROD-NEXT1.E1 owner-only review and privacy receipts are isolated from clients", () => {
  assert.match(page, /requirePlatformSuperadmin\(\)/);
  assert.match(actions, /requirePlatformSuperadmin\(\)/);
  assert.match(migration, /private\.p5_6a_require_owner\(\)/);
  assert.match(migration, /public\.organization_memberships/);
  assert.match(migration, /p_decision='denied'/);
  assert.match(migration, /revok[e]? all on public\.pilot_activation_preferences from public,anon,authenticated/i);
  assert.match(migration, /revoke all on private\.pilot_activation_release_gate from public,anon,authenticated,service_role/);
  assert.match(migration, /create or replace function public\.prod_next1e_set_analytics_preference/);
});

test("PROD-NEXT1.E1 metric vocabulary is exact and no customer emitter is present", () => {
  const names = [
    "valid_bill_created", "private_rfq_draft_saved", "supplier_selection_reviewed",
    "qualified_quote_submitted", "po_confirmed",
  ];
  for (const event of names) {
    assert.match(contract, new RegExp('"' + event + '"'));
  }
  assert.match(contract, /PILOT_ACTIVATION_TELEMETRY_ENABLED = false as const/);
  assert.match(page, /Nessuna misura live disponibile/);
  assert.match(page, /non zero conversioni/);
  assert.doesNotMatch(contract, /track\(|insert\(|fetch\(|@vercel\/analytics/);
  assert.doesNotMatch(migration, /create table public\.pilot_activation_events/);
  assert.match(migration, /No SQL insert\/telemetry RPC exists/);
});
