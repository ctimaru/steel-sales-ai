import assert from "node:assert/strict";
import {chromium} from "playwright";

/** Manual, synthetic-only, production read-only. Never capture private data. */
const SITE="https://www.smartsteelsales.com";
const AUTH="https://ecrafjdummcdfycznitx.supabase.co";
assert.equal(process.env.CI,"true");
assert.equal(process.env.GITHUB_REF,"refs/heads/main");
assert.equal(process.env.GITHUB_EVENT_NAME,"workflow_dispatch");
assert.equal(process.env.CALC_DENSE2_PRIVATE3_APPROVAL,"CALC_DENSE2_PRIVATE3_SYNTHETIC_READ_ONLY");
const actors=[
 ["companyA","rqg32-company-a@smartsteelsales.test","RQG32_COMPANY_A_PASSWORD",true],
 ["companyB","rqg32-company-b@smartsteelsales.test","RQG32_COMPANY_B_PASSWORD",true],
 ["viewer","rqg32-viewer@smartsteelsales.test","RQG32_VIEWER_PASSWORD",false],
];
for(const [id,email,key] of actors){
 assert.ok(email.startsWith("rqg32-")&&email.endsWith("@smartsteelsales.test"));
 assert.ok((process.env[key]??"").length>=20,"Dedicated synthetic password unavailable for "+id);
}
let passed=0;
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
 for(const [actor,email,key,canWrite] of actors){
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block",acceptDownloads:false});
   let loginAllowed=true,blockedWrites=0;
   await context.route("**/*",route=>{
    const req=route.request(),url=new URL(req.url());
    if(["GET","HEAD"].includes(req.method()))return route.continue();
    const login=loginAllowed&&req.method()==="POST"&&
      ((url.origin===SITE&&url.pathname==="/login")||
       (url.origin===AUTH&&url.pathname==="/auth/v1/token"&&url.searchParams.get("grant_type")==="password"));
    if(login)return route.continue();
    blockedWrites++;return route.abort("blockedbyclient");
   });
   try{
    const page=await context.newPage();
    const login=await page.goto(SITE+"/login",{waitUntil:"domcontentloaded",timeout:90000});
    assert.ok(login&&login.status()<500,"Synthetic login page not available");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(process.env[key]);
    await page.getByRole("button",{name:"Accedi",exact:true}).click();
    await page.waitForURL(u=>u.origin===SITE&&u.pathname!=="/login",{timeout:90000});
    loginAllowed=false;
    const result=await page.goto(SITE+"/rfq-hub/distinta",{waitUntil:"domcontentloaded",timeout:90000});
    assert.ok(result&&result.status()<500,"Private route returned server error");
    const path=new URL(page.url()).pathname;
    if(canWrite){
      assert.equal(path,"/rfq-hub/distinta","Company writer must reach private builder");
      const shell=page.locator("[data-private-calculator-shell]");
      const cockpit=shell.locator("#calcolatore-pesi");
      await cockpit.waitFor({state:"visible",timeout:45000});
      assert.ok(await shell.locator('[data-private-calculator-toolbar]').isVisible());
      assert.ok(await shell.locator('[data-private-calculator-heading] input').isVisible());
      const grade=shell.locator("[data-private-calculator-grade]");
      await grade.locator("summary").click();
      assert.ok(await grade.locator("input").isVisible(),"Optional grade remains reachable");
      const norm=cockpit.locator('select[aria-label="Norma"]');
      const shape=cockpit.locator('select[aria-label="Sagoma"]');
      assert.equal(await norm.count(),1);
      assert.equal(await shape.count(),1);
      await shell.locator('[data-testid="private-cart-inline-open"]').click();
      await page.locator('#buyer-live-preview-dialog').waitFor({state:"visible",timeout:15000});
      const bodyWidth=await page.evaluate(()=>({
       client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth
      }));
      assert.ok(bodyWidth.scroll<=bodyWidth.client+12,"Horizontal overflow in authenticated builder");
    }else{
      assert.notEqual(path,"/rfq-hub/distinta","Read-only viewer must not enter write-only builder");
      assert.equal(await page.locator("[data-private-calculator-shell]").count(),0);
    }
    passed++;console.log("CALC-DENSE2 PRIVATE.3 PASS",actor,width,canWrite?"allowed":"denied","blockedWrites",blockedWrites);
   }finally{loginAllowed=false;await context.close();}
  }
 }
 assert.equal(passed,6);
 console.log("CALC-DENSE2 PRIVATE.3 COMPLETE",passed,"read-only synthetic scenarios");
}finally{await browser.close();}
