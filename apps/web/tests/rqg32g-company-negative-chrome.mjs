/**
 * RQG3.2g: Production Chrome NEGATIVE company-role acceptance.
 * Only 3 currently unassigned synthetic QA identities; no real tenant data.
 * No application writes, legal acceptance, company activation or Role grants.
 */
import assert from "node:assert/strict";
import {chromium} from "playwright";
const APP="https://www.smartsteelsales.com";
const AUTH="https://ecrafjdummcdfycznitx.supabase.co";
assert.equal(process.env.CI,"true");
assert.equal(process.env.GITHUB_EVENT_NAME,"workflow_dispatch");
assert.equal(process.env.GITHUB_REF,"refs/heads/main");
assert.equal(process.env.RQG32G_APPROVAL,"RQG32G_INSPECT_UNASSIGNED_COMPANY_TEST_USERS");
const actors=[
  {name:"companyA",email:"rqg32-company-a@smartsteelsales.test",pw:"RQG32_COMPANY_A_PASSWORD"},
  {name:"companyB",email:"rqg32-company-b@smartsteelsales.test",pw:"RQG32_COMPANY_B_PASSWORD"},
  {name:"viewer",email:"rqg32-viewer@smartsteelsales.test",pw:"RQG32_VIEWER_PASSWORD"},
];
const markers=["RQG32-ORG_A-20261013","RQG32-ORG_B-20261013"];
const allowedRedirects=new Set(["/login","/register","/registration/status",
  "/dashboard","/onboarding","/legal/accept","/staff/access","/platform"]);
for(const actor of actors)assert.ok((process.env[actor.pw]??"").length>=20);
assert.equal(new Set(actors.map(a=>a.email)).size,3);
const browser=await chromium.launch({headless:true,channel:"chrome"});
let passed=0,loginPosts=0,blockedWrites=0;
const contexts=[];
try{
  for(const actor of actors){
    const ctx=await browser.newContext({serviceWorkers:"block",locale:"it-IT",
      viewport:{width:actor.name==="viewer"?390:1440,height:850},acceptDownloads:false});
    contexts.push(ctx);
    let loginOpen=true;
    await ctx.route("**/*",route=>{
      const req=route.request(),method=req.method(),url=new URL(req.url());
      if(method==="GET"||method==="HEAD")return route.continue();
      const webLogin=loginOpen&&method==="POST"&&url.origin===APP&&url.pathname==="/login";
      const authLogin=loginOpen&&method==="POST"&&url.origin===AUTH&&
        url.pathname==="/auth/v1/token"&&url.searchParams.get("grant_type")==="password";
      if(webLogin||authLogin){loginPosts++;return route.continue();}
      blockedWrites++;return route.abort("blockedbyclient");
    });
    const page=await ctx.newPage();
    const first=await page.goto(APP+"/login",{waitUntil:"domcontentloaded",timeout:90000});
    assert.ok(first&&first.status()<500);
    await page.locator('input[name="email"]').fill(actor.email);
    await page.locator('input[name="password"]').fill(process.env[actor.pw]);
    await page.getByRole("button",{name:"Accedi",exact:true}).click();
    await page.waitForURL(u=>u.origin===APP&&u.pathname!=="/login",{timeout:90000});
    loginOpen=false;
    assert.ok(loginPosts>0);
    passed++;
    for(const routeName of ["/operations/review","/platform/review","/review"]){
      const probe=await ctx.newPage();
      try{
        try{
          const response=await probe.goto(APP+routeName,{waitUntil:"domcontentloaded",timeout:90000});
          assert.ok(!response||response.status()<500,"Unexpected HTTP server error");
        }catch(e){if(!String(e).includes("net::ERR_ABORTED"))throw e;}
        await probe.waitForURL(u=>u.origin===APP&&allowedRedirects.has(u.pathname),{
          timeout:60000
        });
        assert.notEqual(new URL(probe.url()).pathname,routeName,
          "Unauthorized QA company user reached protected Review");
        const body=await probe.locator("body").innerText();
        assert.ok(!body.includes("Review dati commerciali"),
          "Company Review content leaked");
        assert.ok(markers.every(marker=>!body.includes(marker)),
          "Private synthetic Review marker leaked");
        passed++;
      }finally{await probe.close();}
    }
    console.log("RQG32G PASS",actor.name,"no tenant or Platform Review access");
  }
  assert.ok(loginPosts>=3,"Real logins not observed");
  console.log("RQG32G COMPANY NEGATIVE CHROME PASS: "+passed+
    " checks; application mutation requests transmitted=0; blocked attempts="+blockedWrites);
}catch(e){
  console.error("RQG32G CHROME BLOCKED",e instanceof Error?e.name:"Error");
  process.exitCode=1;
}finally{
  for(const ctx of contexts)await ctx.close();
  await browser.close();
}
