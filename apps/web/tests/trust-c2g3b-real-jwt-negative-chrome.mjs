/**
 * TRUST-C2G3B: real GoTrue sign-in + Chrome denial for six already-authorized
 * synthetic QA identities. Read-only after login, no screenshots/traces/cookies.
 * Only run AFTER the rights route is deployed to production from protected main.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const ORIGIN = "https://www.smartsteelsales.com";
const AUTH_ORIGIN = "https://ecrafjdummcdfycznitx.supabase.co";
const TARGET = "/platform/network-trust/source-rights";
const APPROVAL = "TRUST_C2G3B_READ_ONLY_PRODUCTION_JWT";
assert.equal(process.env.CI,"true");
assert.equal(process.env.GITHUB_REF,"refs/heads/main");
assert.equal(process.env.GITHUB_EVENT_NAME,"workflow_dispatch");
assert.equal(process.env.GITHUB_REPOSITORY,"ctimaru/steel-sales-ai");
assert.equal(process.env.C2G3B_APPROVAL,APPROVAL);

const identities=[
  {tag:"platform-registration",email:"rqg32-registration@smartsteelsales.test",key:"RQG32_REGISTRATION_PASSWORD"},
  {tag:"platform-claims",email:"rqg32-claims@smartsteelsales.test",key:"RQG32_CLAIMS_PASSWORD"},
  {tag:"platform-trust",email:"rqg32-trust@smartsteelsales.test",key:"RQG32_TRUST_PASSWORD"},
  {tag:"platform-auditor",email:"rqg32-auditor@smartsteelsales.test",key:"RQG32_AUDITOR_PASSWORD"},
  {tag:"company-a",email:"rqg32-company-a@smartsteelsales.test",key:"RQG32_COMPANY_A_PASSWORD"},
  {tag:"company-b",email:"rqg32-company-b@smartsteelsales.test",key:"RQG32_COMPANY_B_PASSWORD"}
];
for(const entry of identities){
  assert.ok((process.env[entry.key]??"").length>=20,"Required protected synthetic test account is unavailable");
}
const browserInstance=await chromium.launch({channel:"chrome",headless:true});
let loginCount=0,deniedCount=0;
try{
 for(const person of identities){
   const ctx=await browserInstance.newContext({locale:"it-IT",serviceWorkers:"block",
     acceptDownloads:false,viewport:{width:person.tag.startsWith("company")?390:1440,height:900}});
   let signingIn=true;
   await ctx.route("**/*",route=>{
     const req=route.request(),url=new URL(req.url());
     if(["GET","HEAD"].includes(req.method()))return route.continue();
     const passwordLogin=signingIn&&req.method()==="POST"&&(
       (url.origin===ORIGIN&&url.pathname==="/login")||
       (url.origin===AUTH_ORIGIN&&url.pathname==="/auth/v1/token"&&
        url.searchParams.get("grant_type")==="password"));
     if(passwordLogin){loginCount++;return route.continue();}
     return route.abort("blockedbyclient");
   });
   try {
     const page=await ctx.newPage();
     const login=await page.goto(ORIGIN+"/login",{waitUntil:"domcontentloaded",timeout:90000});
     assert.ok(login&&login.status()===200,"Login endpoint unavailable");
     await page.locator('input[name="email"]').fill(person.email);
     await page.locator('input[name="password"]').fill(process.env[person.key]);
     await page.getByRole("button",{name:"Accedi",exact:true}).click();
     await page.waitForURL(u=>u.origin===ORIGIN&&u.pathname!=="/login",{timeout:90000});
     signingIn=false;

     const response=await page.goto(ORIGIN+TARGET,{waitUntil:"domcontentloaded",timeout:90000});
     assert.ok(response&&response.status()<500,"Protected route/server error");
     const landed=new URL(page.url());
     assert.equal(landed.origin,ORIGIN,"Cross-origin redirect not allowed");
     assert.notEqual(landed.pathname,TARGET,"Nonowner can access source rights console");
     assert.ok(["/platform","/dashboard","/staff/access","/onboarding","/login"].includes(landed.pathname),
       "Denied role routed to unexpected location");
     const body=await page.locator("body").innerText();
     assert.ok(!body.includes("TRUST-C2G.3 · Platform Owner only"),
       "Owner evidence console leaked through denied route");
     deniedCount++;
     console.log("TRUST-C2G3B PASS",person.tag,"real login; owner-only route denied");
   } finally {
     await ctx.close();
   }
 }
 assert.ok(loginCount>=identities.length,"Did not observe real GoTrue login");
 assert.equal(deniedCount,identities.length);
 console.log("TRUST-C2G3B CHROME NEGATIVE ACCESS PASS",deniedCount,"signed-in synthetic personas");
} catch(err){
 // Deliberately do not print credential-bearing browser errors or URLs.
 console.error("TRUST-C2G3B BLOCKED",err?.name??"Error");
 process.exitCode=1;
}finally{
 await browserInstance.close();
}
