import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const source = read("../lib/review-boundaries.ts");
const claims = read("../app/(italian)/(platform)/platform/company-claims/actions.ts");
const discovery = read("../app/(italian)/(platform)/platform/company-discovery/actions.ts");
const company = read("../app/(italian)/(workspace)/review/page.tsx");
const companyActions = read("../app/(italian)/(workspace)/review/actions.ts");
const platform = read("../app/(italian)/(platform)/platform/review/page.tsx");
async function boundaries() {
  const mod = new SourceTextModule(stripTypeScriptTypes(source));
  const routes = new SyntheticModule(["appRoutes"], function () {
    this.setExport("appRoutes", {
      operations: { review: "/operations/review" },
      platform: { review:"/platform/review", registrations:"/platform/registrations",
        claims:"/platform/company-claims", discovery:"/platform/company-discovery",
        networkTrust:"/platform/network-trust", knowledge:"/platform/knowledge" }
    });
  });
  await mod.link((name) => { assert.equal(name, "@/lib/routes"); return routes; });
  await mod.evaluate();
  return mod.namespace;
}
test("RQG3 read-only auditor cannot decide in any Platform domain", async () => {
  const { PLATFORM_REVIEW_LANES: lanes, visiblePlatformReviewLanes: visible,
    allowedPlatformReviewDecisions: permitted } = await boundaries();
  assert.equal(lanes.length, 5);
  assert.deepEqual(visible(["platform.console.access"]), []);
  for (const lane of lanes) {
    assert.equal(visible([lane.readPermission]).length, 1);
    assert.deepEqual(permitted(lane, [lane.readPermission]), []);
    assert.ok(lane.decisionActions.length >= 2);
    assert.equal(new Set(lane.decisionActions.map(x => x.permission)).size, lane.decisionActions.length);
    for (const action of lane.decisionActions) {
      assert.deepEqual(permitted(lane, [lane.readPermission, action.permission]).map(x => x.permission), [action.permission]);
    }
  }
});
test("RQG3 review rights never imply activation/publication or approval", async () => {
  const { PLATFORM_REVIEW_LANES: lanes, allowedPlatformReviewDecisions: permitted } = await boundaries();
  const expected = {
    registrations:["registrations.review","registrations.request_information","registrations.approve","registrations.reject","registrations.activate","registrations.bridge_network"],
    claims:["claims.review_proof","claims.approve","claims.reject","claims.revoke"],
    discovery:["discovery.review","discovery.publish","discovery.enrich","discovery.close_duplicates","discovery.governance_review"],
    network_trust:["network_trust.verify","network_trust.revoke","network_trust.review_changes","network_trust.identity_review"],
    knowledge:["knowledge.review","knowledge.publish"]
  };
  for (const lane of lanes) assert.deepEqual(lane.decisionActions.map(x => x.permission), expected[lane.key]);
  const claimsLane = lanes.find(x => x.key === "claims");
  assert.deepEqual(permitted(claimsLane, ["claims.read","claims.review_proof"]).map(x=>x.permission),["claims.review_proof"]);
  assert.deepEqual(permitted(claimsLane, ["claims.read","claims.approve"]).map(x=>x.permission),["claims.approve"]);
  assert.match(platform, /Sola lettura · nessuna decisione autorizzata/);
  assert.doesNotMatch(platform,/getReviewItems\(|commercial_review_queue|\.rpc\(/);
});
async function claimHarness(allowed) {
  const calls={checks:[],rpc:[]};
  const mod=new SourceTextModule(stripTypeScriptTypes(claims));
  const mock = {
    "@/lib/user-facing-error":{safeErrorMessage:()=>"Errore"},
    "next/cache":{revalidatePath:()=>{}},
    "next/navigation":{redirect:(href)=>{throw new Error("NEXT_REDIRECT "+href);}},
    "@/lib/platform-admin":{requirePlatformPermission:async (p)=>{calls.checks.push(p); if(!allowed.includes(p))throw new Error("denied");}},
    "@/lib/supabase/server":{createClient:async()=>({rpc:async (name,args)=>{calls.rpc.push({name,args});return {data:{},error:null};}})},
  };
  await mod.link((name)=>{
    assert.ok(mock[name],name);
    return new SyntheticModule(Object.keys(mock[name]), function(){for(const [k,v] of Object.entries(mock[name]))this.setExport(k,v);});
  });
  await mod.evaluate();
  return {actions:mod.namespace,calls};
}
function form(decision) {
  const f=new FormData();
  f.set("claim_id","11111111-1111-4111-8111-111111111111"); f.set("decision",decision); return f;
}
test("RQG3 direct Claim decisions reject forged read/review/approve rights before RPC", async () => {
  for(const [granted,decision,needed] of [
    [["claims.read"],"approved","claims.approve"],
    [["claims.review_proof"],"approved","claims.approve"],
    [["claims.approve"],"rejected","claims.reject"],
    [["claims.reject"],"revoked","claims.revoke"],
  ]){
    const {actions,calls}=await claimHarness(granted);
    await assert.rejects(actions.reviewCompanyClaim(form(decision)),/denied/);
    assert.deepEqual(calls.checks,[needed]);
    assert.deepEqual(calls.rpc,[]);
  }
});
test("RQG3 authorized Claim decisions use separate domain RPC and never company correction", async () => {
  for (const [decision,required] of [
    ["approved","claims.approve"],["rejected","claims.reject"],["revoked","claims.revoke"],["under_review","claims.review_proof"],
  ]) {
    const {actions,calls}=await claimHarness([required]);
    await assert.rejects(actions.reviewCompanyClaim(form(decision)),/NEXT_REDIRECT/);
    assert.deepEqual(calls.checks,[required]);
    assert.equal(calls.rpc.length,1);
    assert.equal(calls.rpc[0].name,"m4_review_company_claim");
    assert.equal(calls.rpc[0].args.p_decision,decision);
  }
  const {actions,calls}=await claimHarness(["claims.read"]);
  await assert.rejects(actions.reviewCompanyClaimProof(form("verified")),/denied/);
  assert.deepEqual(calls.rpc,[]);
});
test("RQG3 other decision domains and company Review maintain independent guards", () => {
  assert.match(discovery,/export async function reviewCompanyDiscovery[\s\S]*?requirePlatformPermission\("discovery\.review"\)/);
  assert.match(discovery,/decision === "publish_new"[\s\S]*?requirePlatformPermission\("discovery\.publish"\)/);
  assert.match(discovery,/decision === "enrich_existing"[\s\S]*?requirePlatformPermission\("discovery\.enrich"\)/);
  assert.match(companyActions,/export async function confirmReviewItem[\s\S]*?await requireWorkspaceAdmin\(\)/);
  assert.match(companyActions,/export async function correctReviewItem[\s\S]*?await requireWorkspaceAdmin\(\)/);
  assert.match(company,/mode === "live" \? \([\s\S]*?<ReviewCorrectForm/);
});
