import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const direct=read("../app/(italian)/(workspace)/review/layout.tsx");
const operations=read("../app/(italian)/(workspace)/operations/review/layout.tsx");
const core=read("../app/(italian)/(workspace)/review/actions.ts");
const srcs=["coverage","conversations","conversation-coverage","identities","offer-recovery","offer-remediation","offer-reparse","relationships"]
  .map(s=>read("../app/(italian)/(workspace)/review/"+s+"/actions.ts"));
const sql=read("../../../supabase/migrations/20261013134506_rqg1_review_access_hardening.sql");
test("RQG1 gates both review URL trees by company admin",()=>{
 assert.match(direct,/await requireWorkspaceAdmin\(\)/);
 assert.match(operations,/await requireWorkspaceAdmin\(\)/);
 assert.doesNotMatch(direct+operations,/requireWorkspaceWriteRole/);
});
test("RQG1 gates every exported server action independently",()=>{
 for(const s of [core,...srcs]){
  const funcs=[...s.matchAll(/export async function (\w+)\(/g)];
  assert.ok(funcs.length>0);
  for(let i=0;i<funcs.length;i++){
   const region=s.slice(funcs[i].index,i+1<funcs.length?funcs[i+1].index:undefined);
   assert.match(region,/await requireWorkspaceAdmin\(\)/);
  }
 }
 assert.match(core,/rpc\("rqg1_confirm_review_item"/);
 assert.doesNotMatch(core,/\.from\("commercial_review_queue"\)\s*\.update/);
});
test("RQG1 RLS, deny-by-default RPCs and row-locked audited confirmations",()=>{
 assert.match(sql,/company review administrator required/);
 assert.match(sql,/rqg1_require_review_admin/);
 assert.match(sql,/m\.role='admin'/);
 assert.match(sql,/commercial_review_queue_organization_select/);
 assert.match(sql,/commercial_correction_events_organization_select/);
 assert.match(sql,/drop policy if exists commercial_review_queue_organization_update/);
 assert.match(sql,/for update/);
 assert.match(sql,/reviewed_by=v_actor/);
 assert.match(sql,/status='pending'/);
 assert.match(sql,/revoke all on function public\.rqg1_confirm_review_item\(bigint\)/);
 assert.doesNotMatch(sql,/grant (?:update|select) on (?:table )?public\.commercial_review_queue/i);
});
test("RQG1 wraps private-review SQL RPCs without changing the shared membership helper",()=>{
 assert.equal((sql.match(/perform public\.rqg1_require_review_admin\(/g)||[]).length,36);
 assert.doesNotMatch(sql,/create or replace function public\.is_organization_member/);
 assert.match(sql,/public\.p1_adopt_offer_reparse_candidate/);
 assert.match(sql,/public\.p1_apply_commercial_review_correction/);
 assert.match(sql,/public\.confirm_contact_company_mapping/);
});
