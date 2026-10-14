/**
 * RQG4.3: canonical navigation and role-scoped Review acceptance.
 * ONLY disposable local GoTrue/Next/Supabase + synthetic Company A/B.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {chromium} from "playwright";

const WEB="http://127.0.0.1:3000";
assert.equal(process.env.CI,"true","Disposable CI only");
assert.equal(process.env.PERF1_WEB_URL,WEB,"Never use hosted Next");
assert.match(process.env.NEXT_PUBLIC_SUPABASE_URL??"",/^http:\/\/(?:127\.0\.0\.1|localhost):54321\/?$/);
assert.ok(process.env.RUNNER_TEMP);
const people=JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,"perf1-personas.json"),"utf8"));
function persona(id){
  const p=people.find(x=>x.id===id);
  assert.ok(p?.userId&&p?.email?.endsWith("@example.test")&&p?.password,"Synthetic actor required");
  return p;
}
const browser=await chromium.launch({channel:"chrome",headless:true});
let checks=0;
async function check(name,fn){await fn();checks++;console.log("RQG43 LOCAL PASS",name);}
async function visit(page,url){
  const response=await page.goto(WEB+url,{waitUntil:"domcontentloaded",timeout:90000});
  assert.ok(!response||response.status()<500,"Local route server exception "+url);
}
async function signIn(page,id){
  const p=persona(id);
  await visit(page,"/login");
  await page.locator('input[name="email"]').fill(p.email);
  await page.locator('input[name="password"]').fill(p.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(u=>u.origin===WEB&&u.pathname!=="/login",{timeout:90000});
}
async function denied(context,route){
  const page=await context.newPage();
  try{
    try{await visit(page,route);}
    catch(e){if(!String(e).includes("net::ERR_ABORTED"))throw e;}
    const landings=new Set(["/login","/dashboard","/register","/onboarding","/platform","/staff/access","/legal/accept"]);
    await page.waitForURL(u=>u.origin===WEB&&landings.has(u.pathname),{timeout:60000});
    assert.notEqual(new URL(page.url()).pathname,route,"Unauthorized URL "+route);
    const body=await page.locator("body").innerText();
    assert.ok(!body.includes("RQG31 PRIVATE A")&&!body.includes("RQG31 PRIVATE B"),
      "Private evidence leaked from denied route");
    assert.ok(!body.includes("Review dati commerciali"),
      "Company Review rendered without Company admin role");
  }finally{await page.close();}
}
async function session(role,width=390){
  const context=await browser.newContext({
    viewport:{width,height:860},locale:"it-IT",serviceWorkers:"block",acceptDownloads:false
  });
  const page=await context.newPage();
  await signIn(page,role);
  return {context,page};
}
try{
  {
    const {context,page}=await session("buyer");
    try{
      await check("Company A Dashboard → profile → Company Review is discoverable and canonical",async()=>{
        await visit(page,"/dashboard");
        await page.getByRole("heading",{name:/Oggi in DEMO Industrial Engineering/}).waitFor();
        await page.getByRole("button",{name:"Apri menu profilo"}).click();
        const menu=page.getByRole("dialog",{name:"Menu profilo"});
        const link=menu.getByRole("link",{name:"Qualità dati aziendali"});
        assert.equal(await link.getAttribute("href"),"/operations/review");
        assert.equal(await menu.getByRole("link",{name:/Platform Review/i}).count(),0);
        await link.click();
        await page.waitForURL(u=>u.pathname==="/operations/review",{timeout:60000});
        await page.getByRole("heading",{name:"Review dati commerciali",level:1}).waitFor();
        const body=await page.locator("body").innerText();
        assert.ok(body.includes("RQG31 PRIVATE A")&&!body.includes("RQG31 PRIVATE B"));
        assert.equal(await page.getByRole("link",{name:"Torna al workspace"}).getAttribute("href"),"/dashboard");
      });
      await check("Company Review advanced links stay in /operations/review/* and never Platform",async()=>{
        const details=page.locator("details").filter({
          has:page.locator('nav[aria-label="Strumenti avanzati della Review"]')
        });
        await details.locator("summary").click();
        const nav=page.getByRole("navigation",{name:"Strumenti avanzati della Review"});
        for(const [name,href] of [
          ["Copertura normalizzazione","/operations/review/coverage"],
          ["Identità aziendali","/operations/review/identities"],
          ["Candidate reparse","/operations/review/offer-reparse"]
        ]){
          assert.equal(await nav.getByRole("link",{name}).getAttribute("href"),href);
        }
        assert.equal(await nav.locator('a[href^="/platform/"]').count(),0);
        await page.getByRole("link",{name:"Torna al workspace"}).click();
        await page.waitForURL(u=>u.pathname==="/dashboard",{timeout:60000});
      });
    }finally{await context.close();}
  }
  {
    const {context,page}=await session("trader",1440);
    try{
      await check("Company B deep Company Review stays tenant-owned",async()=>{
        await visit(page,"/operations/review");
        await page.getByRole("heading",{name:"Review dati commerciali",level:1}).waitFor();
        const body=await page.locator("body").innerText();
        assert.ok(body.includes("RQG31 PRIVATE B")&&!body.includes("RQG31 PRIVATE A"));
        assert.equal(await page.getByRole("group",{name:/^Revisione \d+:/}).count(),2);
      });
      await check("Company B is denied Platform Review",async()=>denied(context,"/platform/review"));
    }finally{await context.close();}
  }
  {
    const {context,page}=await session("producer");
    try{
      await check("Company without imported documents sees setup prompt, never false clean",async()=>{
        await visit(page,"/operations/review");
        await page.getByRole("heading",{name:"Review dati commerciali",level:1}).waitFor();
        await page.getByText("Non ci sono ancora documenti commerciali associati",{
          exact:false
        }).waitFor();
        assert.equal(await page.getByRole("link",{name:/Importa documenti/}).getAttribute("href"),
          "/operations/uploads");
        assert.equal(await page.getByText("Coda pulita").count(),0);
        assert.equal(await page.getByText("Non ci sono correzioni da gestire").count(),0);
      });
    }finally{await context.close();}
  }
  {
    const {context,page}=await session("processor");
    try{
      await check("Company with imported dataset and no Review gets genuine empty state",async()=>{
        await visit(page,"/operations/review");
        await page.getByRole("heading",{name:"Review dati commerciali",level:1}).waitFor();
        await page.getByText("Non ci sono correzioni da gestire").waitFor();
        assert.equal(await page.getByText("Non ci sono ancora documenti commerciali associati",{
          exact:false
        }).count(),0);
        assert.equal(await page.getByRole("link",{name:"Torna al workspace"}).first().getAttribute("href"),
          "/dashboard");
        assert.ok(!(await page.locator("body").innerText()).includes("RQG31 PRIVATE"));
      });
    }finally{await context.close();}
  }
  {
    const {context,page}=await session("buyerViewer",320);
    try{
      await check("Viewer Dashboard hides Company Review entry from profile navigation",async()=>{
        await visit(page,"/dashboard");
        await page.getByRole("button",{name:"Apri menu profilo"}).click();
        const menu=page.getByRole("dialog",{name:"Menu profilo"});
        assert.equal(await menu.getByRole("link",{name:"Qualità dati aziendali"}).count(),0);
        assert.equal(await menu.locator('a[href^="/operations/review"]').count(),0);
      });
      await check("Viewer direct canonical AND legacy Review URLs all denied",async()=>{
        for(const route of ["/operations/review","/review","/operations/review/coverage",
          "/review/coverage","/operations/review/identities","/operations/review/offer-reparse"]){
          await denied(context,route);
        }
      });
    }finally{await context.close();}
  }
  for(const role of ["platformStaff","owner"]){
    const {context,page}=await session(role);
    try{
      await check(role+" reaches Platform Review and sees no private Company evidence",async()=>{
        await visit(page,"/platform/review");
        await page.getByRole("heading",{name:"Platform Review",level:1}).waitFor({timeout:60000});
        assert.equal(new URL(page.url()).pathname,"/platform/review");
        const body=await page.locator("body").innerText();
        assert.ok(body.includes("Code di governance abilitate"));
        assert.ok(!body.includes("RQG31 PRIVATE"));
        assert.ok(!body.includes("Review dati commerciali"));
      });
      await check(role+" Platform navigation does not advertise Company Review",async()=>{
        const nav=page.getByRole("navigation",{name:"Navigazione mobile Platform"});
        assert.equal(await nav.locator('a[href^="/operations/review"]').count(),0);
        assert.equal(await page.locator('a[href="/platform/review"]').count()>0,true);
      });
      await check(role+" denied canonical and legacy Company Review deep links",async()=>{
        for(const route of ["/operations/review","/review","/operations/review/coverage"]){
          await denied(context,route);
        }
      });
    }finally{await context.close();}
  }
  console.log("RQG43 LOCAL RELEASE NAVIGATION PASS",checks,
    "checks; companies and legal fixtures local-only; no hosted commercial reads or decisions");
}finally{await browser.close();}
