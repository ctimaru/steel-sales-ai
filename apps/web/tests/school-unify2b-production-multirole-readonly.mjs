/** Approved-only real production Chrome, seven EXISTING synthetic users. */
import assert from "node:assert/strict";
import {chromium} from "playwright";
const SITE="https://www.smartsteelsales.com",AUTH="https://ecrafjdummcdfycznitx.supabase.co";
assert.equal(process.env.GITHUB_EVENT_NAME,"workflow_dispatch");
assert.equal(process.env.GITHUB_REF,"refs/heads/main");
assert.equal(process.env.CI,"true");
assert.equal(process.env.SCHOOL_UNIFY2B_APPROVAL,"SCHOOL_UNIFY2B_APPROVE_SYNTHETIC_READ_ONLY");
const actors=[
 ["registration","rqg32-registration@smartsteelsales.test","RQG32_REGISTRATION_PASSWORD"],
 ["claims","rqg32-claims@smartsteelsales.test","RQG32_CLAIMS_PASSWORD"],
 ["trust","rqg32-trust@smartsteelsales.test","RQG32_TRUST_PASSWORD"],
 ["auditor","rqg32-auditor@smartsteelsales.test","RQG32_AUDITOR_PASSWORD"],
 ["companyA","rqg32-company-a@smartsteelsales.test","RQG32_COMPANY_A_PASSWORD"],
 ["companyB","rqg32-company-b@smartsteelsales.test","RQG32_COMPANY_B_PASSWORD"],
 ["viewer","rqg32-viewer@smartsteelsales.test","RQG32_VIEWER_PASSWORD"],
];
for(const [id,email,key] of actors){
 assert.match(email,/^rqg32[-.].+@smartsteelsales\.test$/);
 assert.ok((process.env[key]??"").length>=20,"Synthetic QA credential missing: "+id);
}
const logged=new Set(),granted=new Set(),denied=new Set();
const fallbacks=new Set(["/login","/dashboard","/onboarding","/register","/registration/status","/legal/accept","/staff/access","/platform"]);
const browser=await chromium.launch({channel:"chrome",headless:true});
let loginPosts=0,blockedWrites=0;
try{
 for(const [id,email,key] of actors){
  const ctx=await browser.newContext({serviceWorkers:"block",acceptDownloads:false,
    viewport:{width:id==="viewer"||id==="auditor"?390:1440,height:850}});
  let allowLogin=true;
  await ctx.route("**/*",route=>{
   const req=route.request(),method=req.method(),url=new URL(req.url());
   if(["GET","HEAD"].includes(method))return route.continue();
   const web=allowLogin&&method==="POST"&&url.origin===SITE&&url.pathname==="/login";
   const token=allowLogin&&method==="POST"&&url.origin===AUTH&&url.pathname==="/auth/v1/token"&&url.searchParams.get("grant_type")==="password";
   if(web||token){loginPosts++;return route.continue();}
   blockedWrites++;return route.abort("blockedbyclient");
  });
  try{
   const page=await ctx.newPage();
   const r=await page.goto(SITE+"/login",{waitUntil:"domcontentloaded",timeout:90000});
   assert.ok(r&&r.status()<500);
   await page.locator('input[name="email"]').fill(email);
   await page.locator('input[name="password"]').fill(process.env[key]);
   await page.getByRole("button",{name:"Accedi",exact:true}).click();
   await page.waitForURL(u=>u.origin===SITE&&u.pathname!=="/login",{timeout:90000});
   allowLogin=false;logged.add(id);
   const view=await page.goto(SITE+"/commercial/knowledge",{waitUntil:"domcontentloaded",timeout:90000});
   assert.ok(!view||view.status()<500);
   const pathname=new URL(page.url()).pathname;
   const allowed=pathname==="/commercial/knowledge"&&await page.getByRole("heading",{name:"Documenti e memoria commerciale",exact:true}).count()===1;
   if(allowed){
     const form=page.locator("form").filter({has:page.locator('input[name="query"]')}).first();
     assert.equal(await form.locator('input[name="query"]').count(),1);
     assert.ok((await form.locator('input[name="query"]').getAttribute("placeholder")||"").length>0);
     granted.add(id);
     const legacy=await page.goto(SITE+"/school/explorer?lang=en",{waitUntil:"domcontentloaded",timeout:90000});
     assert.ok(!legacy||legacy.status()<500);
     assert.equal(new URL(page.url()).pathname,"/commercial/knowledge","Legacy School bookmark must move to Commercial Memory");
     assert.equal(await page.locator('input[name="query"]').count(),1);
   }else{
     assert.ok(fallbacks.has(pathname),"Unexpected guard redirect: "+id);
     assert.equal(await page.locator('input[name="query"]').count(),0,"Private search leaked: "+id);
     denied.add(id);
   }
   console.log("SCHOOL-UNIFY2B AUTH READ-ONLY PASS",id,allowed?"authorized UI":"protected redirect");
  }finally{await ctx.close();}
 }
 assert.equal(logged.size,7);assert.ok(loginPosts>=7);
 console.log("SCHOOL-UNIFY2B ROLE MATRIX",JSON.stringify({logins:logged.size,allowed:granted.size,denied:denied.size,
  writesTransmitted:0,blockedMutations:blockedWrites,crossTenantSearch:"NOT RUN; requires approved scoped pilot"}));
}finally{await browser.close();}
