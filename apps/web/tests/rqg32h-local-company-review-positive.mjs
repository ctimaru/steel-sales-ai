/**
 * RQG3.2h — Real Chrome positive Company Review acceptance, DISPOSABLE LOCAL.
 * The local setup seeds test-only registration/legal fixtures; never hosted.
 * Real GoTrue JWT, real Next pages and RLS. Read-only: RQG3.1 independently
 * tests confirm/correct RPC mutations on the same disposable local DB.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {chromium} from "playwright";
import {createClient} from "@supabase/supabase-js";

assert.equal(process.env.CI,"true","Ephemeral CI only");
const WEB="http://127.0.0.1:3000";
const API="http://127.0.0.1:54321";
assert.equal(process.env.PERF1_WEB_URL,WEB,"Local Next only");
assert.match(process.env.NEXT_PUBLIC_SUPABASE_URL??"",
  /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/, "Local Supabase only");
assert.ok(process.env.RUNNER_TEMP,"Ephemeral CI directory required");
const KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(KEY&&KEY.length>20,"Only local public client key accepted");
const persons=JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,"perf1-personas.json"),"utf8"));
const selected=["buyer","trader","buyerViewer","platformStaff","owner"].map(id=>{
  const p=persons.find(q=>q.id===id);
  assert.ok(p&&p.password&&p.userId, "Missing ephemeral QA identity");
  assert.ok(p.email.endsWith("@example.test"),"Only synthetic local accounts");
  return p;
});
assert.equal(new Set(selected.map(p=>p.userId)).size,5,"Distinct account identities");
const idOf=(role)=>selected.find(p=>p.id===role);
const expected={
  buyer:{ids:[98031,98032],marker:"RQG31 PRIVATE A",other:"RQG31 PRIVATE B",
    organization:"00000000-0000-0000-0000-000000023301"},
  trader:{ids:[98033,98034],marker:"RQG31 PRIVATE B",other:"RQG31 PRIVATE A",
    organization:"00000000-0000-0000-0000-000000023303"},
  buyerViewer:{ids:[],organization:"00000000-0000-0000-0000-000000023301"},
  platformStaff:{ids:[]},
  owner:{ids:[]},
};
const allIds=[98031,98032,98033,98034];
function integers(rows){return rows.map(row=>Number(row.id)).sort((a,b)=>a-b);}
const clients=new Map();
let passed=0;
async function check(label,fn){
  await fn();passed++;console.log("RQG32H LOCAL PASS",label);
}
try{
  // Use REAL user-JWT PostgREST: access decisions must be based on authenticated
  // identities, not a service credential or direct privileged SQL.
  for(const actor of selected){
    const client=createClient(API,KEY,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    const {data,error}=await client.auth.signInWithPassword({
      email:actor.email,password:actor.password
    });
    assert.ifError(error);
    assert.equal(data.user?.id,actor.userId);
    clients.set(actor.id,client);
    const {data:review,error:readErr}=await client.from("commercial_review_queue")
      .select("id,source_text,organization_id").in("id",allIds);
    assert.ifError(readErr);
    const wants=expected[actor.id];
    assert.deepEqual(integers(review),wants.ids,actor.id+" RLS visibility");
    if(wants.organization)assert.ok(review.every(row=>row.organization_id===wants.organization),
      "Cross-company review organization leak");
    await check(actor.id+" exact user-JWT Review RLS",async()=>{});
  }
  // The browser access gate must depend on BOTH legitimate role and legal state.
  // Synthetic legal acknowledgments exist ONLY in the throwaway local SQL.
  for(const role of ["buyer","trader","buyerViewer"]){
    const {data,error}=await clients.get(role).rpc("lr5_current_legal_acceptance_state");
    assert.ifError(error);
    assert.equal(data?.accepted,true,"Local QA legal fixture not loaded");
    await check(role+" isolated local-only legal prerequisite",async()=>{});
  }
  const browser=await chromium.launch({headless:true,channel:"chrome"});
  const sessions=[];
  const deniedDestinations=new Set(["/dashboard","/onboarding","/register",
    "/staff/access","/platform","/login","/legal/accept"]);
  async function visit(page,pathname){
    const response=await page.goto(WEB+pathname,{waitUntil:"domcontentloaded",timeout:90000});
    assert.ok(!response||response.status()<500,"Local app endpoint failed");
  }
  async function denied(context,target){
    const page=await context.newPage();
    try{
      try{await visit(page,target);}
      catch(err){if(!String(err).includes("net::ERR_ABORTED"))throw err;}
      await page.waitForURL(u=>u.origin===WEB&&deniedDestinations.has(u.pathname),{
        timeout:60000
      });
      assert.notEqual(new URL(page.url()).pathname,target);
      const body=await page.locator("body").innerText();
      assert.ok(!body.includes("RQG31 PRIVATE A")&&!body.includes("RQG31 PRIVATE B"),
        "Private evidence leaked to unauthorized actor");
      assert.ok(!body.includes("Review dati commerciali"),
        "Unauthorized Company Review rendered");
    }finally{await page.close();}
  }
  try{
    for(const actor of selected){
      const ctx=await browser.newContext({locale:"it-IT",serviceWorkers:"block",
        viewport:{width:actor.id==="buyerViewer"?390:1440,height:850},
        acceptDownloads:false});
      sessions.push(ctx);
      const page=await ctx.newPage();
      await visit(page,"/login");
      await page.locator('input[name="email"]').fill(actor.email);
      await page.locator('input[name="password"]').fill(actor.password);
      await page.getByRole("button",{name:"Accedi",exact:true}).click();
      await page.waitForURL(u=>u.pathname!=="/login",{timeout:90000});
      if(actor.id==="buyer"||actor.id==="trader"){
        const wants=expected[actor.id];
        await visit(page,"/operations/review");
        await page.getByText(wants.marker,{exact:false}).first().waitFor({
          state:"visible",timeout:60000
        });
        const body=await page.locator("body").innerText();
        assert.equal(new URL(page.url()).pathname,"/operations/review");
        assert.ok(body.includes("Review dati commerciali"),"Company Review missing");
        assert.ok(body.includes(wants.marker),"Own evidence missing");
        assert.ok(!body.includes(wants.other),"Other tenant evidence exposed");
        await check(actor.id+" Chrome positive own Company Review, deny other tenant",async()=>{});
        await denied(ctx,"/platform/review");
        await check(actor.id+" Chrome rejects Platform Review",async()=>{});
      }else{
        await denied(ctx,"/operations/review");
        await denied(ctx,"/review");
        await check(actor.id+" Chrome Company Review denied",async()=>{});
        if(actor.id==="buyerViewer"){
          await denied(ctx,"/platform/review");
          await check("viewer with current local legal fixture still denied Platform Review",async()=>{});
        }
      }
    }
    // RQG3.1 separately asserts real correction/confirmation and audit in
    // this same disposable database, after this read-only acceptance.
    console.log("RQG32H LOCAL COMPANY POSITIVE ACCEPTANCE",passed,
      "checks; tenant A/B isolated; viewer/staff/owner denied; hosted operations=0");
  }finally{
    for(const ctx of sessions)await ctx.close();
    await browser.close();
  }
}finally{
  for(const client of clients.values())await client.auth.signOut().catch(()=>{});
}
