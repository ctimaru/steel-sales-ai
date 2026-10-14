/**
 * RQG4.2 — Company Review multi-role accessibility acceptance.
 * ALL sessions & business fixtures are disposable localhost GoTrue/Next/PostgREST.
 * Browser tests are read-only; RQG3.1 tests decisions separately AFTER this suite.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {chromium} from "playwright";

const BASE="http://127.0.0.1:3000";
assert.equal(process.env.CI,"true","Ephemeral CI runner only");
assert.equal(process.env.PERF1_WEB_URL,BASE,"Never test hosted production");
assert.match(process.env.NEXT_PUBLIC_SUPABASE_URL??"",
  /^http:\/\/(?:127\.0\.0\.1|localhost):54321\/?$/,"Never use hosted Supabase");
assert.ok(process.env.RUNNER_TEMP,"Disposable credentials required");
const personas=JSON.parse(readFileSync(
  path.join(process.env.RUNNER_TEMP,"perf1-personas.json"),"utf8"));
const selected=["buyer","trader","buyerViewer","platformStaff","owner"].map(id=>{
  const p=personas.find(row=>row.id===id);
  assert.ok(p&&p.email?.endsWith("@example.test")&&p.password,"Only disposable QA actors");
  return p;
});
assert.equal(new Set(selected.map(p=>p.userId)).size,5);
const EXPECTED={
  buyer:{mine:"RQG31 PRIVATE A",other:"RQG31 PRIVATE B",ids:["98031","98032"]},
  trader:{mine:"RQG31 PRIVATE B",other:"RQG31 PRIVATE A",ids:["98033","98034"]},
};
const forbiddenLanding=new Set(["/dashboard","/login","/register",
  "/onboarding","/platform","/staff/access","/legal/accept"]);
let count=0;
async function check(title,fn){
  await fn();
  count++;
  console.log("RQG42 LOCAL PASS",title);
}
const browser=await chromium.launch({channel:"chrome",headless:true});
async function visit(page,route){
  const response=await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:90000});
  assert.ok(!response||response.status()<500,"Local route failed");
}
async function login(page,persona){
  await visit(page,"/login");
  await page.locator('input[name="email"]').fill(persona.email);
  await page.locator('input[name="password"]').fill(persona.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(u=>u.pathname!=="/login",{timeout:90000});
}
async function deny(page,pathname){
  try{await visit(page,pathname);}
  catch(err){if(!String(err).includes("net::ERR_ABORTED"))throw err;}
  await page.waitForURL(u=>u.origin===BASE&&forbiddenLanding.has(u.pathname),{
    timeout:60000
  });
  assert.notEqual(new URL(page.url()).pathname,pathname);
  const body=await page.locator("body").innerText();
  assert.ok(!body.includes("RQG31 PRIVATE A")&&!body.includes("RQG31 PRIVATE B"));
  assert.ok(!body.includes("Review dati commerciali"));
}
async function noOverflow(page,width){
  await page.setViewportSize({width,height:860});
  const sizes=await page.evaluate(()=>({
    visible:document.documentElement.clientWidth,
    page:document.documentElement.scrollWidth
  }));
  assert.ok(sizes.page<=sizes.visible+8,
    "Company Review horizontal overflow at "+width+"px");
}
async function hitTarget(locator,label){
  const rect=await locator.boundingBox();
  assert.ok(rect&&rect.height>=43,label+" below 44px touch target");
}
async function buttonContrast(locator){
  const rgb=await locator.evaluate(el=>{
    const style=getComputedStyle(el);
    return {foreground:style.color,background:style.backgroundColor};
  });
  function luminance(input){
    const values=(input.match(/[\d.]+/g)??[]).slice(0,3).map(Number);
    assert.equal(values.length,3,"Expected an opaque RGB color");
    const [r,g,b]=values.map(v=>{
      const c=v/255;
      return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;
    });
    return 0.2126*r+0.7152*g+0.0722*b;
  }
  const a=luminance(rgb.foreground),b=luminance(rgb.background);
  const ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  assert.ok(ratio>=4.5,"Small button text contrast below WCAG AA: "+ratio.toFixed(2));
}
try{
  for(const role of ["buyer","trader"]){
    const persona=selected.find(p=>p.id===role);
    const want=EXPECTED[role];
    const context=await browser.newContext({locale:"it-IT",serviceWorkers:"block",
      viewport:{width:390,height:860},acceptDownloads:false});
    try{
      const page=await context.newPage();
      await login(page,persona);
      await visit(page,"/operations/review");
      await page.getByRole("heading",{name:"Review dati commerciali",level:1}).waitFor();
      await check(role+" sees own synthetic Review only",async()=>{
        const body=await page.locator("body").innerText();
        assert.ok(body.includes(want.mine)&&!body.includes(want.other),
          "Cross-company evidence leak");
        assert.equal(await page.getByRole("group",{name:/^Revisione \d+:/}).count(),2);
        for(const id of want.ids) {
          assert.equal(await page.getByRole("group",{name:new RegExp("^Revisione "+id+":")}).count(),1);
        }
        assert.equal(await page.getByText("Da verificare",{exact:true}).count(),2);
        assert.equal(await page.getByRole("button",{name:"Conferma",exact:true}).count(),2);
        assert.equal(await page.getByText("Strumenti avanzati",{exact:false}).count(),1);
      });
      await check(role+" keyboard opens advanced tools and correction",async()=>{
        const tools=page.locator("details").filter({has:page.locator('nav[aria-label="Strumenti avanzati della Review"]')});
        const summary=tools.locator("summary");
        await summary.focus();
        await page.keyboard.press("Enter");
        assert.equal(await tools.evaluate(el=>el.open),true,"Enter failed to open native details");
        const nav=page.getByRole("navigation",{name:"Strumenti avanzati della Review"});
        assert.equal(await nav.getByRole("link").count(),3);
        await page.keyboard.press("Enter");
        assert.equal(await tools.evaluate(el=>el.open),false,"Enter failed to close native details");

        const card=page.getByRole("group",{name:new RegExp("^Revisione "+want.ids[0]+":")});
        const edit=card.locator("details");
        const editSummary=edit.locator("summary");
        await editSummary.focus();
        await page.keyboard.press("Enter");
        assert.equal(await edit.evaluate(el=>el.open),true);
        for(const label of ["Qualità acciaio","Norma di riferimento","Diametro esterno in millimetri",
          "Quantità","Prezzo","Nota della revisione"]){
          assert.equal(await edit.getByRole("textbox",{name:label,exact:true}).count(),1,
            "Field lacks accessible name: "+label);
        }
        await edit.getByRole("textbox",{name:"Qualità acciaio"}).focus();
        assert.equal(await edit.getByRole("textbox",{name:"Qualità acciaio"}).evaluate(
          el=>document.activeElement===el),true,"Correction input cannot receive keyboard focus");
        await hitTarget(editSummary,"Correction summary");
        await hitTarget(card.getByRole("button",{name:"Conferma",exact:true}),"Confirm button");
        await hitTarget(edit.getByRole("button",{name:"Salva correzione"}),"Correction save");
        await buttonContrast(card.getByRole("button",{name:"Conferma",exact:true}));
        await buttonContrast(edit.getByRole("button",{name:"Salva correzione"}));
      });
      await check(role+" accessible layout at 320 / 390 / 768 / 1440",async()=>{
        for(const width of [320,390,768,1440]){
          await noOverflow(page,width);
          await page.getByRole("heading",{name:"Review dati commerciali",level:1}).waitFor();
          const summary=page.locator("details").filter({
            has:page.locator('nav[aria-label="Strumenti avanzati della Review"]')
          }).locator("summary");
          await hitTarget(summary,"Advanced tools trigger");
        }
      });
      await check(role+" cannot reach Platform Review",async()=>{
        const probe=await context.newPage();
        try{await deny(probe,"/platform/review");}
        finally{await probe.close();}
      });
    }finally{await context.close();}
  }

  for(const role of ["buyerViewer","platformStaff","owner"]){
    const actor=selected.find(p=>p.id===role);
    const context=await browser.newContext({locale:"it-IT",serviceWorkers:"block",
      viewport:{width:role==="buyerViewer"?320:390,height:860},acceptDownloads:false});
    try{
      const page=await context.newPage();
      await login(page,actor);
      await check(role+" denied Company Review alias and legacy deep link",async()=>{
        for(const route of ["/operations/review","/review"]){
          await deny(page,route);
        }
      });
    }finally{await context.close();}
  }
  console.log("RQG42 LOCAL MULTI-ROLE A11Y ACCEPTANCE PASS",count,
    "checks; GoTrue/Next/Chrome localhost; business writes=0; hosted operations=0");
}finally{await browser.close();}
