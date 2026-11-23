/**
 * COMM-RFQ-UX3.A synthetic authenticated Chrome journey, LOCAL CI ONLY.
 * Exercises the genuine Next server action against a strict local fixture,
 * plus real reviewer/preview React state. Never touches production users.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import fixture from "./comm-rfq-ux3a-local-fixture.cjs";

const base = process.env.DEMOTEST23_WEB_URL;
assert.equal(process.env.CI, "true");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true");
assert.equal(base, "http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
assert.ok(process.env.RUNNER_TEMP);
assert.equal(fixture.lines.length, 10);
const personas = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "demotest23-personas.json"), "utf8"));
const buyer = personas.find(p=>p.id === "buyer");
const viewer = personas.find(p=>p.id === "buyerViewer");
assert.ok(buyer && viewer);
const screens = path.join(process.env.RUNNER_TEMP, "comm-rfq-ux3a-visual-evidence");
mkdirSync(screens, {recursive:true});

const noOverflow = async (page, label) => {
  const bounds = await page.evaluate(() => ({
    client:document.documentElement.clientWidth,
    content:document.documentElement.scrollWidth,
  }));
  assert.ok(bounds.content <= bounds.client+12, label+" horizontal overflow "+JSON.stringify(bounds));
};
async function login(page, p) {
  await page.goto(base+"/login", {waitUntil:"domcontentloaded",timeout:90000});
  await page.locator('input[name="email"]').fill(p.email);
  await page.locator('input[name="password"]').fill(p.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(url=>url.pathname==="/dashboard", {timeout:90000});
}
const browser = await chromium.launch({channel:"chrome",headless:true});
try {
  for(const width of [1440,390,320]) {
    const height = width===1440 ? 900 : width===390 ? 844 : 720;
    for(const p of [buyer,viewer]) {
      const context = await browser.newContext({
        viewport:{width,height},isMobile:width<1000,
        deviceScaleFactor:width<1000?2:1,locale:"it-IT",reducedMotion:"reduce"
      });
      try {
        const page = await context.newPage();
        await login(page,p);
        if(p.id === "buyerViewer") {
          // DISTINTA-ONE1: the old link redirects to /rfq-hub/distinta, which is
          // write-only; a viewer lands on the read-only RFQ Hub instead.
          await page.goto(base+"/commercial?compose=1&method=ai#commercial-ai-intake",{waitUntil:"domcontentloaded",timeout:90000});
          await page.waitForURL(u=>u.pathname==="/rfq-hub",{timeout:60000});
          await page.getByRole("heading",{name:"Centro RFQ",exact:true}).waitFor({state:"visible",timeout:60000});
          assert.equal(await page.locator("#rfqai2-text-input").count(),0,"Viewer must never receive editable RFQ chat");
          assert.equal(await page.locator("#distinta-smart-box").count(),0,"Viewer must never receive the editable box");
          assert.equal(await page.getByTestId("comm-cine11-prompt").count(),0);
          await noOverflow(page,"viewer-"+width);
          await page.screenshot({path:path.join(screens,`ux3a-viewer-${width}-readonly.png`),animations:"disabled"});
          console.log("COMM-RFQ-UX3.A VIEWER READONLY PASS",width);
          continue;
        }
        await page.goto(base+"/commercial?compose=1&method=ai#commercial-ai-intake",{waitUntil:"domcontentloaded",timeout:90000});
        // DISTINTA-SMART1: one box; a multi-line request goes to the AI with «Analizza».
        const composer = page.locator("#distinta-smart-box");
        await composer.waitFor({state:"visible",timeout:60000});
        await composer.fill(fixture.text);
        await page.getByRole("button",{name:"Analizza la richiesta con AI"}).click();
        const articles=page.locator(".rfqai3-candidate");
        await articles.first().waitFor({state:"visible",timeout:60000});
        assert.equal(await articles.count(),10,"Ten actual model-result candidates must render");
        // Proposals are reviewed under the box; the Distinta does not exist until approval.
        const sheet=page.getByTestId("distinta-sheet");
        const approved=page.getByTestId("distinta-sheet-lines");
        assert.equal(await sheet.count(),0,"No proposal is counted in the Distinta before approval");
        await noOverflow(page,"ten-candidates-"+width);
        await articles.first().scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(screens,`ux3a-buyer-${width}-ten-proposals-chat.png`),animations:"disabled"});
        // AI analysis ran once only; chat corrections do not call the model.
        await composer.fill("riga 2: 20 barre");
        await page.getByRole("button",{name:"Correggi proposta AI"}).click();
        const line2=page.getByRole("article",{name:"Articolo AI 2",exact:true});
        await page.waitForFunction(() =>
          document.querySelector('[aria-label="Articolo AI 2"]')?.textContent?.includes("20 PZ"),
          {timeout:60000}
        );
        assert.match(await line2.innerText(),/20 PZ/);
        const check2=line2.locator('input[type="checkbox"]');
        await check2.check();
        assert.equal(await check2.isChecked(),true);
        await composer.fill("riga 2: spessore 5 mm");
        await page.getByRole("button",{name:"Correggi proposta AI"}).click();
        await page.waitForFunction(() => {
          const article=document.querySelector('[aria-label="Articolo AI 2"]');
          return article?.textContent?.includes("120 × 80 × 5 mm") || article?.textContent?.includes("120 × 80 × 5");
        },{timeout:60000});
        assert.equal(await check2.isChecked(),false,"New correction revokes previous buyer confirmation");
        assert.equal(await sheet.count(),0);
        await noOverflow(page,"corrected-"+width);
        await page.screenshot({path:path.join(screens,`ux3a-buyer-${width}-corrected-preview.png`),animations:"disabled"});
        // Only five explicitly checked rows join the canonical private Distinta.
        for(let i=1;i<=5;i++){
          await page.getByRole("article",{name:"Articolo AI "+i,exact:true}).locator('input[type="checkbox"]').check();
        }
        await page.getByRole("button",{name:"Inserisci 5 articoli nella distinta"}).click();
        await page.waitForFunction(() =>
          document.querySelectorAll('[data-testid="distinta-sheet-lines"] > li').length === 5,
          {timeout:60000}
        );
        assert.equal(await approved.locator(":scope > li").count(),5);
        assert.match(await sheet.textContent(),/5 articoli/);
        assert.equal(await sheet.getByRole("button",{name:"Salva solo la distinta"}).isDisabled(),false);
        assert.equal(await articles.count(),0,"No candidate remains counted as approved automatically");
        await noOverflow(page,"approved-five-"+width);
        await page.screenshot({path:path.join(screens,`ux3a-buyer-${width}-five-approved.png`),animations:"disabled"});
        assert.equal(await page.getByTestId("private-cart-trigger").count(),0,
          "The single screen has no cart drawer or floating trigger");
        // Each row opens its own details in place (no drawer).
        const row1=approved.locator(":scope > li").first();
        const toggle=row1.locator("button[aria-expanded]").first();
        assert.equal(await toggle.getAttribute("aria-expanded"),"false");
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-expanded"),"true");
        await row1.getByLabel("Norma della riga 1").waitFor({state:"visible",timeout:30000});
        await toggle.click();
        console.log("COMM-RFQ-UX3.A TEN → CORRECT → FIVE VERIFIED PRIVATE LINES PASS",width);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
console.log("COMM-RFQ-UX3.A AUTHENTICATED LOCAL FUNCTIONAL+VISUAL ACCEPTANCE PASS");
