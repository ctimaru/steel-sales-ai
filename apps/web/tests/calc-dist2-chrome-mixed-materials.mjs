/** CALC-DIST2 — heterogeneous technical bill sign-off.
 * Exercises actual UI and canonical persisted quantities in a disposable
 * localhost browser. No real user credentials, RFQ submission or external sends.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const BASE=process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
const OUTPUT="/tmp/calc-dist2-mixed-materials";
await mkdir(OUTPUT,{recursive:true});
const articles=[
  {standard:"en10219",shape:0,dims:["168.3","6"],bars:"1",length:"12"},
  {standard:"en10219",shape:1,dims:["200","10"],bars:"2",length:"6"},
  {standard:"en10219",shape:2,dims:["150","100","5"],bars:"3",length:"8"},
  {standard:"en10210",shape:0,dims:["88.9","4"],bars:"4",length:"12"},
  {standard:"en10210",shape:1,dims:["100","6"],bars:"5",length:"6"},
  {standard:"en10210",shape:2,dims:["200","100","8"],bars:"2",length:"12"},
  {standard:"en10219",shape:0,dims:["60.3","3"],bars:"3",length:"6"},
  {standard:"en10219",shape:2,dims:["120","80","4"],bars:"2",length:"8"},
];
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
  for(const width of [320,390,1440]) {
    const context=await browser.newContext({
      viewport:{width,height:860},reducedMotion:"reduce",
      serviceWorkers:"block",permissions:["clipboard-read","clipboard-write"]});
    // All work is local and self-contained: prevent outbound provider traffic.
    await context.route("**/*",route=>
      route.request().url().startsWith(BASE+"/")?route.continue():route.abort());
    const page=await context.newPage(),errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    try {
      const response=await page.goto(BASE+"/knowledge/tubes",
        {waitUntil:"domcontentloaded",timeout:60000});
      assert.equal(response?.status(),200);
      const calc=page.locator("#calcolatore-pesi[data-calculator-ready='true']");
      await calc.waitFor({state:"visible"});
      const consent=page.getByTestId("mobile-cookie-consent");
      if(await consent.isVisible())
        await consent.getByRole("button",{name:"Accetta necessari"}).click();

      for(const [i,spec] of articles.entries()) {
        await calc.getByRole("combobox",{name:"Norma"}).selectOption(spec.standard);
        await calc.locator("[data-calc-shape-buttons] button").nth(spec.shape).click();
        const dims=calc.locator("[data-cockpit-measurements] input");
        assert.equal(await dims.count(),spec.dims.length,"Required dimensions line "+(i+1));
        for(let d=0;d<spec.dims.length;d++) await dims.nth(d).fill(spec.dims[d]);
        await calc.locator("[data-cockpit-length-quantity] input").first().fill(spec.length);
        await calc.locator("#tube-calculator-quantity").fill(spec.bars);
        const add=calc.locator("[data-cockpit-add]");
        assert.equal(await add.isEnabled(),true,"Valid shape can be added: "+(i+1));
        await add.click();
        const lineCount=await page.evaluate(()=>{
          const raw=sessionStorage.getItem("sss:inline-distinta:v1");
          return raw?JSON.parse(raw).lines.length:0;
        });
        assert.equal(lineCount,i+1,"Every real UI add must persist exactly one line");
      }

      const trigger=page.getByTestId("calculator-cart-trigger");
      await trigger.click();
      const drawer=page.locator("#distinta-inline-dialog");
      const rows=drawer.locator("[data-distinta-compact-row]");
      const density=drawer.locator("[data-distinta-toggle-density]");
      assert.equal(await rows.count(),8);
      assert.equal(await drawer.locator("[data-distinta-compact-grid]").getAttribute("data-distinta-multi-row-mode"),"compact");
      assert.equal(await density.getAttribute("aria-pressed"),"false");
      const persisted=await page.evaluate(()=>JSON.parse(
        sessionStorage.getItem("sss:inline-distinta:v1")));
      assert.equal(persisted.lines.length,8);
      assert.equal(new Set(persisted.lines.map(line=>line.description+"|"+line.standard)).size,8,
        "Distinct geometry/standards cannot collapse into duplicate rows");
      assert.equal(persisted.lines.filter(l=>l.standard==="EN 10210").length,3);
      assert.equal(persisted.lines.filter(l=>l.standard==="EN 10219").length,5);
      assert.ok(persisted.lines.every(l=>Number(l.weightKgM)>0));
      assert.ok(persisted.lines.every(l=>l.targetEurT===""),"No private rate in stored cart");

      const initialMeters=persisted.lines.reduce((total,l)=>
        total+Number(l.quantity)*Number(l.barLengthM),0);
      const initialTonnes=persisted.lines.reduce((total,l)=>
        total+Number(l.quantity)*Number(l.barLengthM)*Number(l.weightKgM)/1000,0);
      const summary=drawer.locator("[data-technical-cart-summary]");
      assert.ok((await summary.innerText()).includes(initialMeters+" m"));
      assert.ok((await summary.innerText()).includes(initialTonnes.toLocaleString("it-IT",
        {maximumFractionDigits:3})+" t"),"Totals must sum mixed theoretical masses");

      const body=drawer.locator("#distinta-inline-lines");
      await body.evaluate(node=>{node.scrollTop=0;});
      await drawer.screenshot({path:OUTPUT+"/mixed-"+width+"-compact.png",animations:"disabled"});
      await density.click();
      assert.equal(await drawer.locator("[data-distinta-compact-grid]").getAttribute("data-distinta-multi-row-mode"),"detailed");
      await body.evaluate(node=>{node.scrollTop=0;});
      await drawer.screenshot({path:OUTPUT+"/mixed-"+width+"-detailed.png",animations:"disabled"});
      await density.click();

      // Change only one line. Other different geometries and grades are unchanged.
      const before=await page.evaluate(()=>JSON.parse(
        sessionStorage.getItem("sss:inline-distinta:v1")).lines);
      const quantity=rows.nth(2).locator("[data-inline-quantity] input");
      await quantity.fill("4");
      assert.equal(await drawer.locator("[data-create-inline-private-rfq]").isDisabled(),true);
      assert.equal(await drawer.getByRole("button",{name:"Copia distinta"}).isDisabled(),true);
      await quantity.press("Enter");
      assert.equal(await quantity.inputValue(),"4");
      const changed=await page.evaluate(()=>JSON.parse(
        sessionStorage.getItem("sss:inline-distinta:v1")).lines);
      assert.equal(changed[2].quantity,"4");
      assert.ok(changed.every((l,i)=>i===2||JSON.stringify(l)===JSON.stringify(before[i])),
        "Single row quantity edit must preserve all seven other articles");

      // One real buyer grade edit and one private commercial price.
      await rows.nth(1).locator("[data-distinta-row-actions] button").first().click();
      const edit=rows.nth(1).locator('[id^="distinta-inline-edit-"]');
      await edit.getByLabel("Grado acciaio").fill("S355J2H");
      assert.equal(await drawer.locator("[data-create-inline-private-rfq]").isDisabled(),true);
      await edit.getByRole("button",{name:"Salva riga"}).click();
      assert.match(await rows.nth(1).innerText(),/S355J2H/);

      await rows.nth(1).locator("[data-distinta-row-actions] button").nth(3).click();
      const target=rows.nth(1).locator('[id^="private-target-edit-"]');
      await target.locator('input[type="text"]').fill("1234");
      assert.equal(await drawer.locator("[data-create-inline-private-rfq]").isDisabled(),true);
      await target.locator("button").first().click();
      assert.equal(await drawer.locator("[data-create-inline-private-rfq]").isDisabled(),false);
      assert.equal(await rows.nth(1).locator("[data-buyer-target]").count(),1);

      const technicalSnapshot=await page.evaluate(()=>JSON.parse(
        sessionStorage.getItem("sss:inline-distinta:v1")).lines);
      assert.ok(technicalSnapshot.every(l=>l.targetEurT===""),
        "Commercial buyer prices must never enter the technical session draft");
      await drawer.getByRole("button",{name:"Copia distinta"}).click();
      const copied=await page.evaluate(()=>navigator.clipboard.readText());
      assert.match(copied,/S355J2H/);
      assert.match(copied,/EN 10210/);
      assert.match(copied,/EN 10219/);
      assert.doesNotMatch(copied,/1234/,"Private target price must not enter clipboard");
      assert.equal(await drawer.locator("[data-create-inline-private-rfq]").count(),1);
      await body.evaluate(node=>{node.scrollTop=0;});
      await drawer.screenshot({path:OUTPUT+"/mixed-"+width+"-edited.png",animations:"disabled"});

      // The drawer remains functional after restoring its canonical tab-scoped bill.
      await page.reload({waitUntil:"domcontentloaded"});
      await trigger.click();
      assert.equal(await rows.count(),8);
      assert.equal(await drawer.locator("[data-create-inline-private-rfq]").count(),1);
      assert.equal(await rows.nth(2).locator("[data-inline-quantity] input").inputValue(),"4");
      assert.equal(await rows.nth(1).locator("[data-buyer-target]").count(),0,
        "React-only buyer price must not survive a browser reload");
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+4),false);
      assert.deepEqual(errors,[]);
      console.log("CALC-DIST2 heterogeneous materials PASS",width,
        "rows 8, norms 2, shapes 3, private rate retained only in mounted React");
    } finally {
      await context.close();
    }
  }
} finally {await browser.close();}
