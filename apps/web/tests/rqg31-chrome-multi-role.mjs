/**
 * RQG3.1: real Chrome + real GoTrue + real PostgREST (disposable local DB).
 * Production credentials and API writes are explicitly forbidden.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const base = process.env.PERF1_WEB_URL;
const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(base, "http://127.0.0.1:3000", "No nonlocal Next target");
assert.match(api ?? "", /^http:\/\/(?:127\.0\.0\.1|localhost):54321\/?$/, "No production RPC target");
assert.ok(process.env.RUNNER_TEMP);
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key && key.length > 20, "Local publishable key required");
const readPersona = (name) => JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,name),"utf8"));
const existing = readPersona("perf1-personas.json");
const extra = readPersona("rqg31-personas.json");
const actors = [...existing,...extra];
const byId = (id) => {
  const actor = actors.find(a=>a.id===id);
  assert.ok(actor,"Missing actor "+id);
  return actor;
};
const browser = await chromium.launch({ headless:true, channel:"chrome" });
const sessions = new Map();
let passed=0;
async function run(label,fn) {
  try { await fn(); passed++; console.log("RQG31 PASS",label); }
  catch (e) { console.error("RQG31 FAIL",label,e instanceof Error?e.message:String(e));throw e; }
}
async function visit(page,pathname) {
  const response=await page.goto(base+pathname,{waitUntil:"domcontentloaded",timeout:90000});
  assert.ok(response,"No response for "+pathname);
  assert.ok(response.status()<500,pathname+" server error "+response.status());
  const body=await page.locator("body").innerText({timeout:30000});
  assert.ok(!body.includes("Application error: a server-side exception"),pathname+" crashed");
  return body;
}
async function signIn(actor) {
  const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:"it-IT"});
  const page=await ctx.newPage();
  await visit(page,"/login");
  await page.locator('input[name="email"]').fill(actor.email);
  await page.locator('input[name="password"]').fill(actor.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(u=>u.pathname!=="/login",{timeout:90000});
  sessions.set(actor.id,{ctx,page});
  return page;
}
async function rejectPage(page,route) {
  const body=await visit(page,route);
  await page.waitForURL(u=>u.pathname!==route,{timeout:60000});
  assert.notEqual(new URL(page.url()).pathname,route, "Direct access improperly granted "+route);
  assert.ok(!body.includes("RQG31 PRIVATE A"),"Private data leaked via redirect");
}
async function clientFor(id) {
  const actor=byId(id);
  const client=createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.signInWithPassword({email:actor.email,password:actor.password});
  assert.ifError(error);
  assert.ok(data.session?.access_token,"Missing authenticated JWT "+id);
  return client;
}
function ids(data){return (data??[]).map(x=>Number(x.id)).sort((a,b)=>a-b);}
const clients=new Map();
async function actorClient(id){if(!clients.has(id))clients.set(id,await clientFor(id));return clients.get(id);}
const nonexistent="00000000-0000-4000-8000-000000039999";
try {
  const anonymous=await browser.newContext({locale:"it-IT"});
  const anon=await anonymous.newPage();
  await run("anonymous denied both review domains",async()=>{
    for(const route of ["/platform/review","/operations/review","/review"]) {
      await visit(anon,route);
      await anon.waitForURL(u=>u.pathname==="/login",{timeout:30000});
    }
  });
  await anonymous.close();

  for(const id of ["buyer","trader","buyerViewer","owner","platformStaff","claimsStaff","trustStaff","auditor"]) {
    await run(id+" signs in with real GoTrue Chrome session",async()=>{await signIn(byId(id));});
  }

  for(const [id,wanted,excluded] of [
    ["buyer","RQG31 PRIVATE A","RQG31 PRIVATE B"],
    ["trader","RQG31 PRIVATE B","RQG31 PRIVATE A"],
  ]) {
    await run(id+" Company Review sees ONLY current tenant",async()=>{
      const page=sessions.get(id).page;
      await visit(page,"/operations/review");
      // Next may stream the private queue after the initial HTML shell.
      // Await the *expected owned evidence*, rather than sampling a partial body.
      await page.getByText(wanted,{exact:false}).first().waitFor({state:"visible",timeout:60000});
      const body=await page.locator("body").innerText();
      assert.equal(new URL(page.url()).pathname,"/operations/review");
      assert.ok(body.includes(wanted),id+" missing own review evidence");
      assert.ok(!body.includes(excluded),id+" read another tenant review evidence");
      assert.ok(body.includes("Qualità dati aziendali"));
      await visit(page,"/review");
      assert.equal(new URL(page.url()).pathname,"/operations/review", "Legacy /review should canonicalize to Company Review");
      await rejectPage(page,"/platform/review");
    });
  }
  await run("viewer cannot navigate direct Company Review or Platform Review",async()=>{
    const page=sessions.get("buyerViewer").page;
    for(const route of ["/review","/operations/review","/review/identities","/platform/review"])await rejectPage(page,route);
  });
  await run("Platform Owner has all Platform lanes but no automatic Company Review",async()=>{
    const page=sessions.get("owner").page;
    await visit(page,"/platform/review");
    await page.getByRole("heading",{name:"Registrazioni e attivazioni"}).waitFor({state:"visible",timeout:60000});
    const body=await page.locator("body").innerText();
    assert.equal(new URL(page.url()).pathname,"/platform/review");
    for(const name of ["Registrazioni e attivazioni","Rivendicazioni dei profili","Discovery e fonti","Identità e fiducia Network","Qualità Knowledge"])assert.ok(body.includes(name),"Missing owner lane "+name);
    assert.equal(await page.locator('section[aria-labelledby="platform-review-domains"] a').count(),5);
    assert.ok(!body.includes("RQG31 PRIVATE"),"Platform Review leaked commercial review");
    await rejectPage(page,"/operations/review");
  });
  for(const [id,ownPath,excluded] of [
    ["platformStaff","/platform/registrations",["/platform/company-claims","/platform/network-trust","/platform/knowledge"]],
    ["claimsStaff","/platform/company-claims",["/platform/registrations","/platform/network-trust","/platform/knowledge"]],
    ["trustStaff","/platform/network-trust",["/platform/registrations","/platform/company-claims","/platform/knowledge"]],
  ]) {
    await run(id+" has exactly one delegated lane and no tenant privileges",async()=>{
      const page=sessions.get(id).page;
      await visit(page,"/platform/review");
      const laneLinks=page.locator('section[aria-labelledby="platform-review-domains"] a');
      await laneLinks.first().waitFor({state:"visible",timeout:60000});
      const body=await page.locator("body").innerText();
      assert.equal(new URL(page.url()).pathname,"/platform/review");
      assert.equal(await laneLinks.count(),1,"Unexpected delegated lanes");
      assert.equal(await laneLinks.first().getAttribute("href"),ownPath);
      assert.ok(body.includes("Decisioni abilitate:"));
      assert.ok(!body.includes("RQG31 PRIVATE"));
      for(const forbidden of excluded)await rejectPage(page,forbidden);
      await rejectPage(page,"/review");
    });
  }
  await run("Platform auditor can inspect 5 lanes without ANY decision",async()=>{
    const page=sessions.get("auditor").page;
    await visit(page,"/platform/review");
    await page.locator('section[aria-labelledby="platform-review-domains"] a').first().waitFor({state:"visible",timeout:60000});
    const body=await page.locator("body").innerText();
    assert.equal(new URL(page.url()).pathname,"/platform/review");
    assert.equal(await page.locator('section[aria-labelledby="platform-review-domains"] a').count(),5);
    assert.equal((body.match(/Sola lettura · nessuna decisione autorizzata/g)??[]).length,5);
    await visit(page,"/platform/company-claims");
    assert.ok((await page.locator("body").innerText()).includes("Accesso in sola lettura"));
    await rejectPage(page,"/review");
  });
  await run("company Review RLS blocks viewer/platform identities and cross-tenant reads",async()=>{
    const cases=[["buyer",[98031,98032]],["trader",[98033,98034]],["buyerViewer",[]],["owner",[]],["platformStaff",[]],["claimsStaff",[]],["auditor",[]]];
    for(const [id,expected] of cases) {
      const client=await actorClient(id);
      const {data,error}=await client.from("commercial_review_queue").select("id").gte("id",98031).lte("id",98034);
      assert.ifError(error);
      assert.deepEqual(ids(data),expected,id+" RLS read");
    }
  });
  await run("direct Company Review RPC refuses viewer, other tenant and Platform actors",async()=>{
    for(const id of ["trader","buyerViewer","owner","platformStaff","claimsStaff","auditor"]) {
      const client=await actorClient(id);
      const {error}=await client.rpc("rqg1_confirm_review_item",{p_review_id:98031});
      assert.ok(error,id+" must not confirm another tenant item");
      assert.equal(error.code,"42501",id+" RPC authorization failure");
    }
    const other=await actorClient("trader");
    const {error}=await other.rpc("p1_apply_commercial_review_correction",{p_review_id:98032,p_corrected_values:{grade:"P355GH"}});
    assert.equal(error?.code,"42501","Cross-tenant correction denied");
  });
  await run("auditor and registration staff cannot forge Claims/Trust decisions",async()=>{
    for(const id of ["auditor","platformStaff"]) {
      const client=await actorClient(id);
      const {error:claim}=await client.rpc("m4_review_company_claim",{p_claim_id:nonexistent,p_decision:"approved"});
      assert.equal(claim?.code,"42501",id+" claim approval denied");
      const {error:trust}=await client.rpc("m5_review_identity_candidate",{p_candidate_id:nonexistent,p_decision:"confirmed_match"});
      assert.equal(trust?.code,"42501",id+" trust decision denied");
    }
    for(const [id,fn,payload] of [
      ["claimsStaff","m4_review_company_claim",{p_claim_id:nonexistent,p_decision:"approved"}],
      ["trustStaff","m5_review_identity_candidate",{p_candidate_id:nonexistent,p_decision:"dismissed"}],
    ]) {
      const client=await actorClient(id);
      const {error}=await client.rpc(fn,payload);
      assert.ok(error,"Nonexistent target must not be mutated");
      assert.notEqual(error.code,"42501",id+" proper decision role incorrectly denied");
    }
  });
  await run("Chrome Company Admin A confirms synthetic item through REAL Server Action",async()=>{
    const page=sessions.get("buyer").page;
    await visit(page,"/operations/review");
    await page.getByRole("button",{name:"Conferma",exact:true}).first().click();
    await page.getByText("Conferma salvata.",{exact:false}).first().waitFor({state:"visible",timeout:45000});
    const buyer=await actorClient("buyer");
    const {data,error}=await buyer.from("commercial_review_queue")
      .select("id,status,reviewed_by,reviewed_at,source_text").eq("id",98031).single();
    assert.ifError(error);
    assert.equal(data.status,"confirmed");
    assert.equal(data.reviewed_by,byId("buyer").userId);
    assert.ok(data.reviewed_at);
    assert.equal(data.source_text,"RQG31 PRIVATE A CONFIRM");
  });
  await run("confirmed Company Review cannot be submitted a second time",async()=>{
    const buyer=await actorClient("buyer");
    const {error}=await buyer.rpc("rqg1_confirm_review_item",{p_review_id:98031});
    assert.ok(error,"Repeat confirmation was accepted");
    assert.equal(error.code,"55000");
  });
  await run("real Company correction RPC updates only tenant-owned test evidence",async()=>{
    const buyer=await actorClient("buyer");
    const {data,error}=await buyer.rpc("p1_apply_commercial_review_correction",{
      p_review_id:98032,p_corrected_values:{grade:"P355GH"},
    });
    assert.ifError(error);
    assert.equal(data?.status,"corrected");
    const {data:items,error:readError}=await buyer.from("commercial_review_queue")
      .select("id,status,reviewed_by,reviewed_at").in("id",[98032,98033,98034]);
    assert.ifError(readError);
    assert.deepEqual(ids(items),[98032],"Correction never expanded readable scope");
    assert.equal(items[0]?.status,"corrected");
    assert.equal(items[0]?.reviewed_by,byId("buyer").userId);
    const {data:obs,error:obsError}=await buyer.from("commercial_observations")
      .select("grade,source_text").eq("id",98032).single();
    assert.ifError(obsError);
    assert.equal(obs.grade,"P355GH");
    assert.equal(obs.source_text,"RQG31 ORIGINAL A CORRECT");
    const {error:repeat}=await buyer.rpc("p1_apply_commercial_review_correction",{
      p_review_id:98032,p_corrected_values:{grade:"P355GH"},
    });
    assert.ok(repeat,"Repeat correction was accepted");
  });
  await run("Company B remains pending; no decision crossed the boundary",async()=>{
    const trader=await actorClient("trader");
    const {data,error}=await trader.from("commercial_review_queue")
      .select("id,status,reviewed_by").in("id",[98033,98034]);
    assert.ifError(error);
    assert.deepEqual(ids(data),[98033,98034]);
    for(const row of data) {
      assert.equal(row.status,"pending");
      assert.equal(row.reviewed_by,null);
    }
  });
  console.log("RQG3.1 CHROME + POSTGREST ACCEPTANCE:",passed,"checks; LOCAL ONLY; production mutations=0");
} finally {
  for(const {ctx} of sessions.values())await ctx.close();
  await browser.close();
}
