import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261116122500_net_it_auto3_cap1000_owner_reauthorization.sql");
const page=read("../app/(italian)/(platform)/platform/company-discovery/scale15k/page.tsx");
const actions=read("../app/(italian)/(platform)/platform/company-discovery/scale15k/actions.ts");

test("NET-IT-AUTO3-CAP1000 updates only upper bound, not an active Owner policy",()=>{
  assert.match(sql,/CHECK \(daily_cap BETWEEN 1 AND 1000\)/);
  assert.match(sql,/p_daily_cap NOT BETWEEN 1 AND 1000/);
  assert.match(sql,/CREATE OR REPLACE FUNCTION private\.net_it_auto3_set_policy_impl/);
  assert.doesNotMatch(sql.split("CREATE OR REPLACE FUNCTION")[0],/UPDATE private\.net_it_auto3_policy SET/i);
  assert.doesNotMatch(sql,/INSERT INTO private\.net_it_auto3_policy/i);
  assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION private\.net_it_auto3_release/i);
  assert.doesNotMatch(sql,/INSERT INTO public\.network_companies/i);
});

test("NET-IT-AUTO3-CAP1000 preserves signed-in real Owner attestation, expiry and audit",()=>{
  assert.match(sql,/v_actor uuid := auth\.uid\(\)/);
  assert.match(sql,/v_actor IS NULL OR NOT private\.is_platform_superadmin\(\)/);
  assert.match(sql,/private\.has_platform_permission\('platform\.settings\.manage'\)/);
  assert.match(sql,/private\.has_platform_permission\('discovery\.publish'\)/);
  assert.match(sql,/p_attested IS DISTINCT FROM true/);
  assert.match(sql,/p_valid_days NOT BETWEEN 1 AND 90/);
  assert.match(sql,/length\(btrim\(coalesce\(p_note,''\)\)\) NOT BETWEEN 100 AND 2000/);
  assert.match(sql,/INSERT INTO private\.net_it_auto3_events/);
  assert.match(sql,/owner_grant/);
  assert.match(sql,/owner_revoke/);
  assert.match(sql,/authorized_by=CASE WHEN p_enabled THEN v_actor ELSE authorized_by END/);
});

test("NET-IT-AUTO3-CAP1000 supports minimal-click active-owner renewal and preserves revoke",()=>{
  assert.match(page,/factPolicy\.daily_cap < 1000/);
  assert.match(page,/name="daily_cap" value="1000"/);
  assert.match(page,/name="policy_note"/);
  assert.match(page,/name="attested" required/);
  assert.match(page,/Autorizza 1\.000 pubblicazioni al giorno/);
  assert.match(page,/max=\{1000\} defaultValue=\{1000\}/);
  assert.match(page,/name="enabled" value="false"/);
  assert.match(page,/Revoca subito l'autonomia AI/);
  assert.match(actions,/cap < 1 \|\| cap > 1000/);
  assert.match(actions,/requirePlatformPermission\("platform\.settings\.manage"\)/);
  assert.match(actions,/requirePlatformPermission\("discovery\.publish"\)/);
  assert.match(actions,/net_it_auto3_set_policy/);
});
