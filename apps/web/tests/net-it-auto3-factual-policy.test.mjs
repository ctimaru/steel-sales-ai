import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const file = (path) => fs.readFileSync(new URL(path,import.meta.url),"utf8");
const sql=file("../../../supabase/migrations/20261110183000_net_it_auto3_facts_only_release.sql");
const page=file("../app/(italian)/(platform)/platform/company-discovery/scale15k/page.tsx");
const actions=file("../app/(italian)/(platform)/platform/company-discovery/scale15k/actions.ts");
test("facts-only autopublication is default OFF and independently revocable",()=>{
 assert.match(sql,/enabled boolean NOT NULL DEFAULT false/);
 assert.match(sql,/VALUES\(true,false\) ON CONFLICT/);
 assert.match(sql,/private\.is_platform_superadmin\(\)/);
 assert.match(sql,/private\.has_platform_permission\('discovery.publish'\)/);
 assert.match(sql,/p_attested IS DISTINCT FROM true/);
 assert.match(sql,/p_daily_cap NOT BETWEEN 1 AND 300/);
 assert.match(sql,/p_valid_days NOT BETWEEN 1 AND 90/);
 assert.match(sql,/v_policy\.expires_at<=now\(\)/);
 assert.match(sql,/event_kind IN \('owner_grant','owner_revoke','agent_release'\)/);
});
test("agent requires first-party evidence, keeps unknown reuse status explicit",()=>{
 assert.match(sql,/e\.verdict='identity_supported'/);
 assert.match(sql,/e\.reviewed_at>=now\(\)-interval '3 days'/);
 assert.match(sql,/e\.identity_confidence>=0\.94/);
 assert.match(sql,/e\.source_rights_state='unknown'/);
 assert.match(sql,/c\.quality_flags <@ ARRAY\['product_scope_not_verified','province_area_to_verify'\]/);
 assert.match(sql,/c\.legal_name ~\*/);
 assert.match(sql,/NOT c\.personal_data_detected/);
 assert.match(sql,/c\.source_url ~\* '\^https:\/\/'/);
 assert.match(sql,/c\.website_url ~\* '\^https:\/\/'/);
 assert.match(sql,/r\.governance_status='unreviewed'/);
 assert.match(sql,/session_user<>'postgres' OR auth\.uid\(\) IS NOT NULL/);
 assert.match(sql,/pg_catalog\.pg_advisory_xact_lock\(810021,20262\)/);
 assert.match(sql,/publication_actor_type='delegated_agent'/);
 assert.match(sql,/reviewed_at=now\(\),reviewed_by=NULL/);
 assert.doesNotMatch(sql,/UPDATE public\.network_company_discovery_runs/);
 assert.doesNotMatch(sql,/SET governance_status='approved'/);
});
test("only the owner can grant the second policy; action requires separate attestation",()=>{
 assert.match(page,/AUTO2 \+ AUTO3/);
 assert.match(page,/setScale15KFactPolicy/);
 assert.match(page,/Revoca subito l'autonomia AI/);
 assert.match(page,/name="attested"/);
 assert.match(page,/name="policy_note"/);
 assert.match(actions,/requirePlatformPermission\("platform.settings.manage"\)/);
 assert.match(actions,/requirePlatformPermission\("discovery.publish"\)/);
 assert.match(actions,/net_it_auto3_set_policy/);
 assert.match(actions,/p_valid_days: 30/);
});
test("legal form gate: whole-token S.r.l./S.p.A. only, identical in query and guard",()=>{
 const gate=[...sql.matchAll(/legal_name (?:!~\*|~\*) '([^']+)'/g)].map(m=>m[1]);
 assert.equal(gate.length,2);
 assert.equal(gate[0],gate[1]);
 assert.doesNotMatch(gate[0],/n\[\.\]/);
 const js=new RegExp(gate[0].replaceAll("[[:alnum:]]","[a-z0-9]").replaceAll("[^[:alnum:]]","[^a-z0-9]")
   .replaceAll("[[:space:]]","\\s"),"i");
 for(const ok of ["Carpenteria Test S.r.l.","Tubi Nord SPA","Officina Uno S.r.l.s.","Acciai Due S. p. A."])
  assert.match(ok,js,ok);
 for(const ko of ["Officine Gasparini","Carpenteria Bianchi Simone & C. S.n.c.","Valle S.a.s.","Spada Lavorazioni"])
  assert.doesNotMatch(ko,js,ko);
});
test("supported identities are re-verified before the 3-day evidence window closes",()=>{
 const q=file("../../../supabase/migrations/20261110174000_net_it_auto2_first_party_review_queue.sql");
 assert.match(q,/WHEN e\.verdict='identity_supported'\s+THEN interval '2 days' ELSE interval '7 days'/);
});
