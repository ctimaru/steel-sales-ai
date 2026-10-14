/**
 * RQG3.2f: four scoped Platform roles in real production Chrome, strictly
 * read-only except the login POST. Test-only accounts, no company fixtures.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const ORIGIN = "https://www.smartsteelsales.com";
const AUTH_ORIGIN = "https://ecrafjdummcdfycznitx.supabase.co";
const APPROVAL = "RQG32F_APPROVE_PLATFORM_READ_ONLY";
assert.equal(process.env.CI,"true");
assert.equal(process.env.GITHUB_EVENT_NAME,"workflow_dispatch");
assert.equal(process.env.GITHUB_REF,"refs/heads/main");
assert.equal(process.env.RQG32F_APPROVAL,APPROVAL);
const roles = [
  {id:"registration",email:"rqg32-registration@smartsteelsales.test",key:"RQG32_REGISTRATION_PASSWORD",lanes:["/platform/registrations"]},
  {id:"claims",email:"rqg32-claims@smartsteelsales.test",key:"RQG32_CLAIMS_PASSWORD",lanes:["/platform/company-claims"]},
  {id:"trust",email:"rqg32-trust@smartsteelsales.test",key:"RQG32_TRUST_PASSWORD",lanes:["/platform/network-trust"]},
  {id:"auditor",email:"rqg32-auditor@smartsteelsales.test",key:"RQG32_AUDITOR_PASSWORD",lanes:[
    "/platform/registrations","/platform/company-claims","/platform/company-discovery",
    "/platform/network-trust","/platform/knowledge"
  ],readOnly:true},
];
const lanesAll=roles[3].lanes;
const qaMarkers=["RQG32-ORG_A-20261013","RQG32-ORG_B-20261013"];
const safeLandings=new Set(["/login","/register","/dashboard","/onboarding",
  "/platform","/staff/access","/registration/status","/legal/accept"]);
assert.equal(roles.length,4);
assert.equal(new Set(roles.map(p=>p.email)).size,4);
for(const actor of roles) {
  assert.ok((process.env[actor.key]??"").length>=20,"Approved test password is missing");
}

const browser=await chromium.launch({channel:"chrome",headless:true});
let checks=0,blockedWrites=0,loginPosts=0;
const contexts=[];
async function visit(page,path) {
  const res=await page.goto(ORIGIN+path,{waitUntil:"domcontentloaded",timeout:90000});
  assert.ok(!res||res.status()<500,"Destination failed");
}
async function deny(context,path) {
  const p=await context.newPage();
  try {
    try {await visit(p,path);}
    catch(e) {if(!String(e).includes("net::ERR_ABORTED")) throw e;}
    await p.waitForURL(u=>u.origin===ORIGIN&&safeLandings.has(u.pathname),{timeout:60000});
    assert.notEqual(new URL(p.url()).pathname,path,"Forbidden route reachable");
    const body=await p.locator("body").innerText();
    assert.ok(!qaMarkers.some(marker=>body.includes(marker)),"Tenant fixture leaked");
  } finally {await p.close();}
}
try {
  for(const actor of roles) {
    const context=await browser.newContext({locale:"it-IT",serviceWorkers:"block",
      viewport:{width:actor.readOnly?390:1440,height:900},acceptDownloads:false});
    contexts.push(context);
    let signingIn=true;
    await context.route("**/*",route=>{
      const req=route.request(),method=req.method(),url=new URL(req.url());
      if(method==="GET"||method==="HEAD") return route.continue();
      const loginAction=signingIn&&method==="POST"&&url.origin===ORIGIN&&url.pathname==="/login";
      const loginToken=signingIn&&method==="POST"&&url.origin===AUTH_ORIGIN&&
        url.pathname==="/auth/v1/token"&&url.searchParams.get("grant_type")==="password";
      if(loginAction||loginToken){loginPosts++;return route.continue();}
      blockedWrites++;
      return route.abort("blockedbyclient");
    });
    const page=await context.newPage();
    await visit(page,"/login");
    await page.locator('input[name="email"]').fill(actor.email);
    await page.locator('input[name="password"]').fill(process.env[actor.key]);
    await page.getByRole("button",{name:"Accedi",exact:true}).click();
    await page.waitForURL(u=>u.origin===ORIGIN&&u.pathname!=="/login",{timeout:90000});
    signingIn=false;
    assert.ok(loginPosts>0);
    checks++;
    await visit(page,"/platform/review");
    assert.equal(new URL(page.url()).pathname,"/platform/review");
    const links=page.locator('section[aria-labelledby="platform-review-domains"] a');
    await links.first().waitFor({state:"visible",timeout:60000});
    const hrefs=await links.evaluateAll(items=>items.map(x=>x.getAttribute("href")));
    assert.deepEqual(hrefs.slice().sort(),actor.lanes.slice().sort(),
      "Platform lane privilege mismatch");
    const body=await page.locator("body").innerText();
    assert.ok(!qaMarkers.some(marker=>body.includes(marker)),"Private company evidence leaked");
    if(actor.readOnly) {
      assert.equal((body.match(/Sola lettura · nessuna decisione autorizzata/g)||[]).length,5);
      assert.ok(!body.includes("Decisioni abilitate:"));
    } else assert.ok(body.includes("Decisioni abilitate:"));
    checks++;
    await deny(context,"/operations/review");
    for(const forbidden of lanesAll.filter(lane=>!actor.lanes.includes(lane))) {
      await deny(context,forbidden);
    }
    checks++;
    console.log("RQG32F PASS",actor.id,"authenticated, scoped, Company Review denied");
  }
  assert.ok(loginPosts>=4,"Real production login was not observed");
  console.log("RQG32F PLATFORM CHROME PASS",checks,"checks; application mutation requests transmitted=0; blocked attempts="+blockedWrites);
} catch(e) {
  // Never log session bodies, URLs or credentials from Playwright call logs.
  console.error("RQG32F BLOCKED",e?.name??"Error");
  process.exitCode=1;
} finally {
  for(const context of contexts)await context.close();
  await browser.close();
}
