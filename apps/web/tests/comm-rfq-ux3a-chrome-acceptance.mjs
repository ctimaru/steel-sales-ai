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
          await page.goto(base+"/commercial?compose=1&method=ai#commercial-ai-intake",{waitUntil:"domcontentloaded",timeout:90000});
          await page.getByTestId("comm-cine1-hero").waitFor({state:"visible",timeout:60000});
          assert.equal(await page.locator("#rfqai2-text-input").count(),0,"Viewer must never receive editable RFQ chat");
          assert.equal(await page.getByTestId("comm-cine11-prompt").count(),0);
          await noOverflow(page,"viewer-"+width);
          await page.screenshot({path:path.join(screens,`ux3a-viewer-${width}-readonly.png`),animations:"disabled"});
          console.log("COMM-RFQ-UX3.A VIEWER READONLY PASS",width);
          continue;
        }
        await page.goto(base+"/commercial?compose=1&method=ai#commercial-ai-intake",{waitUntil:"domcontentloaded",timeout:90000});
        const composer = page.locator("#rfqai2-text-input");
        await composer.waitFor({state:"visible",timeout:60000});
        await composer.fill(fixture.text);
        await page.getByRole("button",{name:"Analizza la richiesta con AI"}).click();
        const articles=page.locator(".rfqai3-candidate");
        await articles.first().waitFor({state:"visible",timeout:60000});
        assert.equal(await articles.count(),10,"Ten actual model-result candidates must render");
        const live=page.getByTestId("commercial-rfq-live-preview");
        const proposed=page.getByTestId("commercial-rfq-ai-proposals");
        const approved=page.getByTestId("commercial-rfq-approved-lines");
        assert.equal(await proposed.locator("li").count(),10);
        assert.match(await approved.innerText(),/0 righe/);
        assert.equal(await live.getByRole("button",{name:"Salva distinta privata"}).isDisabled(),true);
        await noOverflow(page,"ten-candidates-"+width);
        await articles.first().scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(screens,`ux3a-buyer-${width}-ten-proposals-chat.png`),animations:"disabled"});
        if(width<1000) {
          await page.getByRole("tab",{name:/Distinta/}).click();
          await proposed.waitFor({state:"visible"});
          await page.screenshot({path:path.join(screens,`ux3a-buyer-${width}-ten-proposals-preview.png`),animations:"disabled"});
          await page.getByRole("tab",{name:"Conversazione"}).click();
        }
        // AI analysis ran once only; chat corrections do not call the model.
        await composer.fill("riga 2: 20 barre");
        await page.getByRole("button",{name:"Correggi proposta AI"}).click();
        await page.waitForFunction(() =>
          document.querySelector('[data-testid="commercial-rfq-ai-proposals"]')?.textContent?.includes("Modificato da te · da confermare"),
          {timeout:60000}
        );
        const line2=page.getByRole("article",{name:"Articolo AI 2"});
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
        assert.match(await approved.innerText(),/0 righe/);
        assert.equal(await live.getByRole("button",{name:"Salva distinta privata"}).isDisabled(),true);
        await noOverflow(page,"corrected-"+width);
        if(width<1000) await page.getByRole("tab",{name:/Distinta/}).click();
        await page.screenshot({path:path.join(screens,`ux3a-buyer-${width}-corrected-preview.png`),animations:"disabled"});
        if(width<1000) await page.getByRole("tab",{name:"Conversazione"}).click();
        // Only five explicitly checked rows join the canonical private Distinta.
        for(let i=1;i<=5;i++){
          await page.getByRole("article",{name:"Articolo AI "+i}).locator('input[type="checkbox"]').check();
        }
        await page.getByRole("button",{name:"Inserisci 5 articoli nella distinta"}).click();
        await page.waitForFunction(() =>
          document.querySelector('[data-testid="commercial-rfq-approved-lines"]')?.textContent?.includes("5 righe"),
          {timeout:60000}
        );
        assert.equal(await approved.locator("li").count(),5);
        assert.match(await live.innerText(),/5 righe/);
        assert.equal(await live.getByRole("button",{name:"Salva distinta privata"}).isDisabled(),false);
        assert.equal(await proposed.count(),0,"No candidate remains counted as approved automatically");
        await noOverflow(page,"approved-five-"+width);
        if(width<1000) await page.getByRole("tab",{name:/Distinta/}).click();
        await page.screenshot({path:path.join(screens,`ux3a-buyer-${width}-five-approved.png`),animations:"disabled"});
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
