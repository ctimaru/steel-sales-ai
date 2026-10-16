import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const load = (path) => fs.readFileSync(new URL(path,import.meta.url),"utf8");
const sources = load("../../../supabase/migrations/20261016190000_netux3b1_pending_source_recheck.sql");
const governance = load("../../../supabase/migrations/20261016191000_netux3b1_conflict_reopen_governance.sql");
const page = load("../app/(platform)/platform/company-discovery/geo-review/page.tsx");
const actions = load("../app/(platform)/platform/company-discovery/geo-review/actions.ts");

test("NET-UX3B.1 changes only unreviewed pending evidence and preserves original source in private ledger",()=>{
  assert.match(sources,/network_it_geo_source_recheck_ledger/);
  assert.match(sources,/prior_source_url/);
  assert.match(sources,/updated_source_url/);
  assert.match(sources,/e\.status='pending_review' and e\.reviewed_at is null and e\.reviewed_by is null/);
  assert.match(sources,/v_changed<>2/);
  assert.match(sources,/v_expected=0 then return/);
  assert.match(sources,/external_official_site_recheck_not_human_approval/);
  assert.match(sources,/enable row level security/);
  assert.match(sources,/revoke all on public\.network_it_geo_source_recheck_ledger from public,anon,authenticated/);
  assert.doesNotMatch(sources,/status='approved_for_facility_review'|insert into public\.network_facilities|update public\.network_facilities/);
});

test("NET-UX3B.1 default review selection cannot accidentally record a conflict",()=>{
  assert.match(page,/<select name="decision" required defaultValue=""/);
  assert.match(page,/<option value="" disabled>Seleziona esplicitamente una decisione<\/option>/);
  assert.match(page,/value="conflict">Segnala conflitto/);
  assert.match(page,/value="approved_for_facility_review">Approva per revisione sede/);
});

test("NET-UX3B.1 recovery requires human identity, governance permission and writes audit ledger",()=>{
  assert.match(governance,/private\.require_platform_permission\('discovery.governance_review'\)/);
  assert.match(governance,/v_actor:=auth\.uid\(\)/);
  assert.match(governance,/if v_actor is null/);
  assert.match(governance,/e\.status<>'conflict'/);
  assert.match(governance,/network_it_geo_conflict_reopen_ledger/);
  assert.match(governance,/reopen_note/);
  assert.match(governance,/prior_reviewed_by/);
  assert.match(governance,/set status='pending_review',review_note=null,reviewed_by=null,reviewed_at=null/);
  assert.match(governance,/facility_published',false/);
  assert.match(governance,/language sql security invoker/);
  assert.match(governance,/revoke all on function public\.netux3b1_reopen_conflict\(uuid,text\) from public,anon,authenticated/);
  assert.match(page,/Riapri per una nuova revisione — non approva/);
  assert.match(actions,/await requirePlatformPermission\("discovery.governance_review"\)/);
  assert.match(actions,/netux3b1_reopen_conflict/);
});

test("NET-UX3B.1 exposes only Platform conflict worklist, not any tenant-private memory",()=>{
  assert.match(governance,/private\.require_platform_permission\('discovery.read'\)/);
  assert.match(governance,/e\.status='conflict' and c\.publication_status='published'/);
  assert.doesNotMatch(governance,/network_company_discovery_candidates|rfq_lines|private_company_memory/);
  assert.doesNotMatch(governance,/alter policy|disable row level security/);
});
