/**
 * RQG3.2i — Explicitly approved REAL Company pilot in hosted production.
 * The sole business-data operation is a JWT-scoped GET; browser is GET/HEAD
 * after the legitimate /login POST. No login cookies or artifacts are saved.
 * Requires a dedicated, voluntarily consenting test account, NEVER a
 * customer's existing private password nor a Platform Owner identity.
 */
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createClient} from "@supabase/supabase-js";
import {APPROVAL,PROJECT,LEGAL_VERSION,parseScope} from "./rqg32i-production-company-preflight.mjs";

const APP="https://www.smartsteelsales.com";
const safeLandings=new Set(["/login","/dashboard","/register","/onboarding",
  "/registration/status","/legal/accept","/staff/access","/platform"]);
assert.equal(process.env.CI,"true");
assert.equal(process.env.GITHUB_EVENT_NAME,"workflow_dispatch");
assert.equal(process.env.GITHUB_REF,"refs/heads/main");
assert.equal(process.env.RQG32I_APPROVAL,APPROVAL);
assert.equal(process.env.RQG32I_SUPABASE_URL,PROJECT);
const scope=parseScope(process.env.RQG32I_PILOT_SCOPE_JSON);
const password=process.env.RQG32I_PILOT_PASSWORD??"";
const publicKey=process.env.RQG32I_PUBLISHABLE_KEY??"";
assert.ok(password.length>=20&&password.length<=128,"Dedicated pilot password is missing");
assert.ok(publicKey.startsWith("sb_publishable_")||publicKey.startsWith("eyJ"),
  "Expected pinned production publishable key");
assert.ok(!process.env.RQG32I_ADMIN_KEY,"Privileged Admin key must NEVER reach browser job");
const auth=createClient(PROJECT,publicKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
let context,browser,checks=0,loginPosts=0,blockedWrites=0;
try{
  // Validate real authenticated, tenant-isolated PostgREST GET as the pilot
  // user, NOT with an elevated Admin key. No Review rows or text are logged.
  const {data:session,error:loginError}=await auth.auth.signInWithPassword({
    email:scope.adminEmail,password
  });
  assert.ifError(loginError);
  assert.equal(session?.user?.id,scope.adminUserId,"Unexpected pilot session identity");
  checks++;
  const {data:own,error:readError}=await auth.from("commercial_review_queue")
    .select("id,organization_id,status").eq("id",scope.reviewId);
  assert.ifError(readError);
  assert.equal(own?.length,1,"Authenticated user JWT cannot read own pilot Review");
  assert.equal(own[0]?.organization_id,scope.organizationId,
    "Cross-tenant read or wrong organization");
  assert.equal(own[0]?.status,"pending");
  checks++;

  browser=await chromium.launch({channel:"chrome",headless:true});
  context=await browser.newContext({locale:"it-IT",serviceWorkers:"block",
    viewport:{width:1440,height:850},acceptDownloads:false});
  let signingIn=true;
  await context.route("**/*",route=>{
    const request=route.request(),method=request.method(),url=new URL(request.url());
    if(method==="GET"||method==="HEAD")return route.continue();
    const appLogin=signingIn&&method==="POST"&&url.origin===APP&&url.pathname==="/login";
    const authLogin=signingIn&&method==="POST"&&url.origin===PROJECT&&
      url.pathname==="/auth/v1/token"&&url.searchParams.get("grant_type")==="password";
    if(appLogin||authLogin){loginPosts++;return route.continue();}
    blockedWrites++;return route.abort("blockedbyclient");
  });
  const page=await context.newPage();
  let response=await page.goto(APP+"/login",{waitUntil:"domcontentloaded",timeout:90000});
  assert.ok(response&&response.status()<500);
  await page.locator('input[name="email"]').fill(scope.adminEmail);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(u=>u.origin===APP&&u.pathname!=="/login",{timeout:90000});
  signingIn=false;
  assert.ok(loginPosts>=1,"Real hosted browser login not observed");
  checks++;

  response=await page.goto(APP+"/operations/review",{
    waitUntil:"domcontentloaded",timeout:90000
  });
  assert.ok(!response||response.status()<500);
  assert.equal(new URL(page.url()).pathname,"/operations/review",
    "Approved Company admin cannot enter its Review");
  await page.getByText("Review dati commerciali",{exact:false}).first()
    .waitFor({state:"visible",timeout:60000});
  const body=await page.locator("body").innerText();
  assert.ok(!body.includes("RQG32-ORG_A-20261013")&&
    !body.includes("RQG32-ORG_B-20261013"),"QA fixture appeared in real pilot");
  checks++;

  for(const forbidden of ["/platform/review","/platform/registrations",
    "/platform/company-claims","/platform/network-trust"]){
    const probe=await context.newPage();
    try{
      try{
        response=await probe.goto(APP+forbidden,{
          waitUntil:"domcontentloaded",timeout:90000
        });
        assert.ok(!response||response.status()<500);
      }catch(e){if(!String(e).includes("net::ERR_ABORTED"))throw e;}
      await probe.waitForURL(u=>u.origin===APP&&safeLandings.has(u.pathname),{
        timeout:60000
      });
      assert.notEqual(new URL(probe.url()).pathname,forbidden,
        "Company account entered the Platform Review domain");
      checks++;
    }finally{await probe.close();}
  }
  console.log("RQG32I HOSTED COMPANY PILOT PASS",checks,
    "checks; own JWT-scoped pending Review; Company Chrome positive; Platform denied; application writes transmitted=0; blocked attempts="+blockedWrites);
}catch(e){
  console.error("RQG32I HOSTED COMPANY PILOT BLOCKED",
    e instanceof Error?e.name:"Error");
  process.exitCode=1;
}finally{
  if(context)await context.close();
  if(browser)await browser.close();
  // Do not call signOut: it sends an unnecessary Auth mutation; no persistence.
  void LEGAL_VERSION;
}
