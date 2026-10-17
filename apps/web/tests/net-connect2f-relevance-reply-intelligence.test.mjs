import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261017234500_netconnect2f_reply_intelligence.sql");
const guard=read("../../../supabase/tests/netconnect2f_reply_intelligence.sql");
const hp13=read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");
const gate=read("../../../.github/workflows/p0-required-gate.yml");
const engine=read("../lib/network-relevance.ts");
const backend=read("../lib/network-reply-intelligence.ts");
const ready=read("../components/network-ready-connections.tsx");
const free=read("../components/free-network-directory.tsx");
const pro=read("../app/(italian)/(workspace)/network/page.tsx");
const inbox=read("../app/(italian)/(workspace)/network/connections/page.tsx");
const journey=read("../app/(italian)/(workspace)/network/start/page.tsx");
const reminder=read("../components/copy-connection-reminder.tsx");
const pulse=read("../components/network-reply-pulse.tsx");
test("NET-CONNECT2F authorizes only the active org and approved owned published company",()=>{
 for(const token of ["private.netux11_require_active_company(p_organization_id)","cl.status='approved'",
    "l.link_status='active'","c.publication_status='published'","c.archived_at is null",
    "p_company_ids,1),0)>24"])assert.ok(sql.includes(token),token);
 assert.match(sql,/revoke all on function private\.netconnect2f_intelligence_impl/);
 assert.match(sql,/revoke all on function public\.netconnect2f_intelligence\(uuid,uuid\[\]\) from public,anon/);
 assert.match(hp13,/'netconnect2f_intelligence'/);
 assert.match(hp13,/public\.netconnect2f_intelligence/);
 assert.match(gate,/netconnect2f_reply_intelligence\.sql/);
 assert.match(guard,/has_function_privilege\('anon'/);
});
test("NET-CONNECT2F reply = real decision, sample-size disclosure and no company leaderboard",()=>{
 assert.match(sql,/r\.sender_organization_id=p_organization_id/);
 assert.match(sql,/r\.created_at>=now\(\)-interval '90 days'/);
 assert.match(sql,/r\.status in \('accepted','declined'\)/);
 assert.match(sql,/v_decided>=3/);
 assert.match(sql,/percentile_cont\(0\.5\)/);
 assert.doesNotMatch(sql,/recipient_organization_id.*count|insert into public\./i);
 assert.match(pulse,/Tempo mediano decisione/);
 assert.match(pulse,/almeno 3 decisioni datate/);
 assert.match(pulse,/non misura messaggi o qualità della risposta/);
 assert.match(backend,/netconnect2f_unavailable/);
 assert.match(backend,/netconnect2f_invalid_contract/);
});
test("NET-CONNECT2F role/declared family overlap is explainable and does not invite unclaimed profiles",()=>{
 assert.match(sql,/public\.network_company_products own_p/);
 assert.match(sql,/public\.network_company_products target_p/);
 assert.match(sql,/public\.network_product_families pf/);
 assert.match(engine,/Famiglie prodotto presenti in entrambi i profili/);
 assert.match(ready,/statuses\.get\(x\.id\)==="available"/);
 assert.match(ready,/explainPublishedRelevance/);
 for(const view of [free,pro]){
  assert.match(view,/getNetworkRecipientReadiness/);
  assert.match(view,/getNetworkReplyIntelligence/);
  assert.match(view,/sharedPublicProducts/);
 }
 assert.match(journey,/NetworkReplyPulse/);
});
test("NET-CONNECT2F manual reminder is copy-only, after seven days, never auto-message",()=>{
 assert.match(reminder,/"use client"/);
 assert.match(reminder,/navigator\.clipboard\.writeText/);
 assert.doesNotMatch(reminder,/fetch\(|netconnect1_submit|email\.send|form action|setTimeout/);
 assert.match(inbox,/Date\.now\(\)-Date\.parse\(item\.created_at\)>=7\*24\*60\*60\*1000/);
 assert.match(inbox,/item\.status==="pending"/);
 assert.match(inbox,/CopyConnectionReminder/);
 assert.match(pulse,/pending_over_7_days/);
});
