/**
 * E8C: real Chrome + synthetic local database; no real Italian companies.
 * Run after the original E7B Chrome test and E8C extra 121-row fixture.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {chromium} from "playwright";

assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:54321");
assert.equal(process.env.DEMOTEST23_WEB_URL,"http://127.0.0.1:3000");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER,"true");
const base=process.env.DEMOTEST23_WEB_URL;
const credentials=JSON.parse(fs.readFileSync(path.join(process.env.RUNNER_TEMP,"netgrowth2c1-auditor.json"),"utf8"));
const dir=path.join(process.env.RUNNER_TEMP,"net-it-carp1-e8c-visual");
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
let checks=0;
const app="/platform/company-discovery/carpenterie";
async function runViewport(width) {
 const context=await browser.newContext({
  viewport:{width,height:width===1440?900:width===390?844:720},
  locale:"it-IT",reducedMotion:"reduce",serviceWorkers:"block",
  deviceScaleFactor:width<1000?2:1
 });
 await context.route("**/*",request=>{
  const hostname=new URL(request.request().url()).hostname;
  return hostname==="127.0.0.1"||hostname==="localhost"?request.continue():request.abort();
 });
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try {
  await page.goto(base+"/login",{waitUntil:"domcontentloaded",timeout:90000});
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(u=>["/dashboard","/platform"].includes(u.pathname),{timeout:90000});
  const response=await page.goto(base+app,{waitUntil:"domcontentloaded",timeout:90000});
  assert.equal(response.status(),200);
  const cockpit=page.getByTestId("net-it-carp1-e5-cockpit");
  await cockpit.waitFor({timeout:60000});
  await page.getByRole("heading",{name:"Carpenterie · Console unificata"}).waitFor();
  assert.equal(await page.getByTestId("net-it-carp1-e5-company").count(),40,
    "221-row source view must paginate at 40");
  assert.match(await cockpit.innerText(),/221 risultati/);
  assert.match(await cockpit.innerText(),/E\.8\.C 50/);
  const first=await page.getByTestId("net-it-carp1-e5-company").first().boundingBox();
  assert.ok(first&&first.y < (width===1440?900:width===390?844:720)-24,
    "First company must appear within first screen "+width);
  await assertNoOverflow(page,width,"all");
  await page.screenshot({path:path.join(dir,"e8c-unified-overview-"+width+".png"),fullPage:false,animations:"disabled"});
  checks+=4;

  const cohorts=page.getByRole("navigation",{name:"Filtra per coorte"});
  await cohorts.getByRole("link",{name:/E\.8\.C 50/}).click();
  await page.waitForURL(u=>u.searchParams.get("cohort")==="E8C",{timeout:30000});
  await page.getByTestId("net-it-carp1-e5-company").first().getByText("E8C",{exact:true}).waitFor();
  assert.equal(await page.getByTestId("net-it-carp1-e5-company").count(),40);
  assert.match(await cockpit.innerText(),/50 risultati/);
  await assertNoOverflow(page,width,"E8C");
  await page.screenshot({path:path.join(dir,"e8c-only-"+width+".png"),fullPage:false,animations:"disabled"});
  checks+=3;

  await page.getByRole("link",{name:/Successiva/}).click();
  await page.waitForURL(u=>u.searchParams.get("page")==="2",{timeout:30000});
  assert.equal(await page.getByTestId("net-it-carp1-e5-company").count(),10,"E8C second page");
  checks++;
  const prov=page.getByRole("textbox",{name:"Filtra provincia (sigla)"});
  await prov.fill("BL");
  await page.getByRole("button",{name:"Cerca",exact:true}).click();
  await page.waitForURL(u=>u.searchParams.get("province")==="BL" && !u.searchParams.has("page"),{timeout:30000});
  assert.equal(await page.getByTestId("net-it-carp1-e5-company").count(),12,"Synthetic BL province filter");
  assert.match(await cockpit.innerText(),/12 risultati/);
  checks+=2;
  await page.goto(base+app+"?cohort=E8C&state=location_to_verify",{waitUntil:"domcontentloaded",timeout:90000});
  assert.equal(await page.getByTestId("net-it-carp1-e5-company").count(),40);
  assert.match(await cockpit.innerText(),/43 risultati/);
  await assertNoOverflow(page,width,"province review");
  checks+=3;

  assert.deepEqual(errors,[],"Page errors "+width+": "+errors.join("; "));
  console.log("NET-IT-CARP1.E.8.C CHROME PASS",width,"all synthetic");
 } finally {await context.close();}
}
async function assertNoOverflow(page,width,label) {
 const measurements=await page.evaluate(()=>({
  available:document.documentElement.clientWidth,
  measured:document.documentElement.scrollWidth
 }));
 assert.ok(measurements.measured<=measurements.available+12,
  "Unexpected horizontal scroll "+label+" "+width+": "+JSON.stringify(measurements));
}
try {
 for(const width of [1440,390,320])await runViewport(width);
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 try {
  await page.goto(base+app,{waitUntil:"domcontentloaded",timeout:90000});
  assert.equal(await page.getByTestId("net-it-carp1-e5-company").count(),0);
  assert.ok(!(await page.locator("body").innerText()).includes("FICTIONAL E8C"),"Anon private data leak");
 }finally{await context.close();}
 console.log("NET-IT-CARP1.E.8.C FINAL CHROME PASS",checks,"checks");
}finally{await browser.close();}
