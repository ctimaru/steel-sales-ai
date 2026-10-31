/**
 * NET-GROWTH2C.1 visual acceptance — disposable local CI only.
 * Three responsive viewports, real GoTrue login, platform-scoped reviewer,
 * read-only page, pagination, filters and unauthorized user denial.
 * All screenshot contents use synthetic identities exclusively.
 */
import assert from "node:assert/strict";
import {readFileSync,mkdirSync} from "node:fs";
import path from "node:path";
import {chromium} from "playwright";

assert.equal(process.env.DEMOTEST23_WEB_URL,"http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:54321");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER,"true");
assert.ok(process.env.RUNNER_TEMP,"Ephemeral screenshot directory required");
const synthetic=JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,"demotest23-personas.json"),"utf8"));
const auditor=JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,"netgrowth2c1-auditor.json"),"utf8"));
const unauthorized=synthetic.find(p=>p.id==="producer");
assert.ok(auditor&&unauthorized);
const out=path.join(process.env.RUNNER_TEMP,"netgrowth2c1-safe-screenshots");
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
let assertions=0;

async function session(person,width) {
 const ctx=await browser.newContext({viewport:{width,height:width<=390?860:960},locale:"it-IT",
  reducedMotion:"reduce",serviceWorkers:"block"});
 await ctx.route("**/*",route=>{
  const target=new URL(route.request().url());
  if (["127.0.0.1","localhost","[::1]"].includes(target.hostname)) return route.continue();
  return route.abort();
 });
 const page=await ctx.newPage();
 const errors=[];
 page.on("pageerror",err=>errors.push(err.message));
 await page.goto(process.env.DEMOTEST23_WEB_URL+"/login",{waitUntil:"domcontentloaded",timeout:90000});
 await page.locator('input[name="email"]').fill(person.email);
 await page.locator('input[name="password"]').fill(person.password);
 await page.getByRole("button",{name:"Accedi",exact:true}).click();
 await page.waitForURL(u=>["/dashboard","/platform"].includes(u.pathname),{timeout:90000});
 const cookie=page.getByTestId("mobile-cookie-consent");
 if(await cookie.isVisible().catch(()=>false)){
  const accept=cookie.getByRole("button",{name:/Accetta necessari|Cookie necessari/i});
  if(await accept.count()) await accept.first().click();
 }
 return {ctx,page,errors};
}

try{
 for(const width of [320,390,1440]){
  const {ctx,page,errors}=await session(auditor,width);
  try {
   const root="/platform/company-discovery/identity-recovery";
   const response=await page.goto(process.env.DEMOTEST23_WEB_URL+root,{waitUntil:"domcontentloaded",timeout:90000});
   assert.equal(response.status(),200,"Platform owner/staff page must load");
   await page.getByTestId("net-growth2c1-identity-recovery").waitFor({timeout:45000});
   await page.getByRole("heading",{name:"Recupero identità aziendali"}).waitFor();
   assert.equal(await page.getByTestId("net-growth2c1-identity-item").count(),25,"25 synthetic identities on first page");
   assert.ok(await page.getByText(/Pagina 1\/2/).count(),"28 cases paginate");
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   assert.ok(overflow<=12,"Responsive viewport should not overflow: "+width+" delta "+overflow);
   assert.equal(errors.length,0,"No hydration or runtime errors at width "+width+": "+errors.join("; "));
   await page.screenshot({path:path.join(out,"identity-cockpit-"+width+".png"),fullPage:false,animations:"disabled"});
   await page.getByRole("link",{name:/Successivo/}).click();
   await page.waitForURL(u=>u.searchParams.get("page")==="2");
   assert.equal(await page.getByTestId("net-growth2c1-identity-item").count(),3,"Remaining 3 synthetic leads visible");
   await page.getByRole("link",{name:"Collisioni"}).click();
   await page.waitForURL(u=>u.searchParams.get("kind")==="identity_collision_review"&&u.searchParams.get("page")==="1");
   assert.equal(await page.getByTestId("net-growth2c1-identity-item").count(),2,"Only two duplicated names are collision candidates");
   assertions+=7;
  }finally{await ctx.close();}
 }
 const {ctx,page}=await session(unauthorized,390);
 try{
  await page.goto(process.env.DEMOTEST23_WEB_URL+"/platform/company-discovery/identity-recovery",{waitUntil:"domcontentloaded",timeout:90000});
  await page.waitForURL(u=>!u.pathname.endsWith("/identity-recovery"),{timeout:45000});
  assert.equal(await page.getByTestId("net-growth2c1-identity-item").count(),0,"Tenant must not read Platform recovery rows");
  assertions++;
 }finally{await ctx.close();}
 console.log("NET-GROWTH2C.1 CHROME PASS",assertions,"local-only assertions; 320,390,1440 px; screenshots synthetic");
}finally{await browser.close();}
