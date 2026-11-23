/**
 * COMM-UX6.B — authenticated Professional Deal Workspace visual acceptance.
 * Only disposable FLOW1 Supabase/Next; eight locally seeded private campaigns.
 * Never accesses production data, sends supplier email or calls external URLs.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
const homeHeading = (name) => new RegExp("^(Buongiorno|Buonasera), " + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"); // HOME-FIRSTRUN1B title

const base = process.env.DEMOTEST23_WEB_URL;
assert.equal(base, "http://127.0.0.1:3000", "Only disposable local Next is allowed");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321", "Only disposable local DB is allowed");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true");
const temp = process.env.RUNNER_TEMP;
assert.ok(temp);
const personas = JSON.parse(readFileSync(path.join(temp, "demotest23-personas.json"), "utf8"));
const buyer = personas.find(x => x.id === "buyer");
const viewer = personas.find(x => x.id === "buyerViewer");
const producer = personas.find(x => x.id === "producer");
assert.ok(buyer && viewer && producer);
const dir = path.join(temp, "comm-ux6b-safe-screenshots");
mkdirSync(dir, { recursive: true });

async function logIn(page, persona) {
  await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator('input[name="email"]').fill(persona.email);
  await page.locator('input[name="password"]').fill(persona.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(u => u.pathname === "/dashboard", { timeout: 90000 });
  await page.getByRole("heading", { name: homeHeading(persona.name) })
    .waitFor({ state: "visible", timeout: 60000 });
}
async function assertNoOverflow(page, name) {
  const size = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }));
  assert.ok(size.scroll <= size.client + 12, name + " has horizontal overflow: " + JSON.stringify(size));
}
// COMM-DEALS1: la lista Commerciale è un elenco di trattative (una riga per trattativa).
// COMM-CLIENTS1 (19 nov 2026): /commercial è «Richieste d'offerta», solo vendite.
// Le RFQ ai fornitori (le otto campagne locali COMMUX6B) vivono nel Centro RFQ:
// i vecchi link ?view=sent portano lì.
async function inspectList(page, width, persona) {
  const legacy = await page.goto(base + "/commercial?view=sent&q=COMMUX6B", { waitUntil: "domcontentloaded", timeout: 90000 });
  assert.equal(legacy?.status(), 200);
  await page.waitForURL(u => u.pathname === "/rfq-hub", { timeout: 60000 });

  const response = await page.goto(base + "/commercial?q=COMMUX6B", { waitUntil: "domcontentloaded", timeout: 90000 });
  assert.equal(response?.status(), 200);
  await page.getByRole("heading", { name: "Richieste d'offerta", exact: true, level: 1 })
    .waitFor({ state: "visible", timeout: 60000 });
  assert.equal(await page.getByTestId("commercial-deal-segments").count(), 0, "No Vendite/Acquisti segments any more");
  const list = page.getByTestId("commercial-deals-list");
  await list.waitFor({ state: "visible", timeout: 60000 });
  const listText = await list.innerText();
  assert.doesNotMatch(listText, /COMMUX6B RFQ \d{2}/, "Purchase RFQs live in Centro RFQ, not in Richieste d'offerta");
  assert.doesNotMatch(listText, /Acquisto/);
  assert.doesNotMatch(listText, /DEMOTEST23 PRODUCER PRIVATE RFQ/, "No cross-tenant records");
  // L'assistente resta sulla pagina ma chiuso: la tabella parte nel primo schermo.
  assert.equal(await page.getByTestId("commercial-ai-native-shell").isVisible(), false);
  await assertNoOverflow(page, persona.id + " at " + width);
  await page.screenshot({
    path: path.join(dir, "worklist-" + persona.id + "-" + width + "px.png"),
    fullPage: false, animations: "disabled"
  });
  console.log("COMM-CLIENTS1 RICHIESTE D'OFFERTA PASS", persona.id, width);
}

async function inspectViewer(page, width) {
  const response = await page.goto(base + "/commercial?q=COMMUX6B", {
    waitUntil: "domcontentloaded", timeout: 90000
  });
  assert.equal(response?.status(), 200);
  await page.getByRole("heading", { name: "Richieste d'offerta", exact: true, level: 1 })
    .waitFor({ state: "visible", timeout: 60000 });
  const list = page.getByTestId("commercial-deals-list");
  await list.waitFor({ state: "visible", timeout: 60000 });
  assert.doesNotMatch(await list.innerText(), /DEMOTEST23 PRODUCER PRIVATE RFQ/);
  assert.equal(await page.getByTestId("commercial-new-request").count(), 0);
  assert.equal(await page.getByTestId("comm-cine11-prompt").count(), 0);
  await assertNoOverflow(page, "viewer at " + width);
  await page.screenshot({
    path: path.join(dir, "read-only-viewer-" + width + "px.png"),
    fullPage: false, animations: "disabled"
  });
  console.log("COMM-CLIENTS1 READ-ONLY VIEWER PASS", width);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [1440, 390, 320]) {
    for (const persona of width === 320 ? [buyer] : [buyer, viewer]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 1440 ? 900 : width === 390 ? 844 : 720 },
        isMobile: width < 1000, deviceScaleFactor: width < 1000 ? 2 : 1,
        locale: "it-IT", reducedMotion: "reduce"
      });
      try {
        const page = await context.newPage();
        await logIn(page, persona);
        if (persona.id === "buyerViewer") {
          await inspectViewer(page, width);
          continue;
        }
        await inspectList(page, width, persona);
        if (persona.id === "buyer") {
          // A purchase link of another tenant never opens anything: it lands on
          // Centro RFQ without the record.
          const alien = "/commercial?view=sent&q=COMMUX6B&item=campaign:" + producer.rfq;
          await page.goto(base + alien, { waitUntil: "domcontentloaded", timeout: 90000 });
          await page.waitForURL(u => u.pathname === "/rfq-hub", { timeout: 60000 });
          assert.doesNotMatch(await page.locator("body").innerText(), /DEMOTEST23 PRODUCER PRIVATE RFQ/);

          // COMM-RFQ-UX1: actual authenticated browser handoff. The text
          // must appear before the calculator without any implicit AI call.
          // Preserve the old handoff contract explicitly through the classic rollback route.
          await page.goto(base + "/commercial?experience=classic", { waitUntil: "domcontentloaded", timeout: 90000 });
          const input = page.getByLabel("Descrivi il materiale", { exact: true });
          await input.fill("40 tubi quadri 100x100x6 S355J2H EN 10219 da 12 m");
          await page.getByTestId("commercial-ai-first-cta").click();
          // DISTINTA-ONE1: the Commerciale CTA opens the single «Nuova richiesta» screen.
          await page.waitForURL(url => url.pathname === "/rfq-hub/distinta", { timeout: 60000 });
          const focused = page.getByTestId("new-request-steps");
          await focused.waitFor({ state: "visible", timeout: 60000 });
          // DISTINTA-SMART1: one box above the Distinta, no tabs, no side preview.
          const textField = page.locator("#distinta-smart-box");
          await textField.waitFor({ state: "visible", timeout: 60000 });
          const composer = page.getByTestId("distinta-smart-box");
          assert.equal(await page.locator("[data-rfqai-original-request]").count(), 0,
            "The legacy form accordion must not appear on the single screen");
          // The buyer explicitly clicked "Analizza con l'AI" on Commerciale.
          // The box therefore sends one authenticated request, while no proposal
          // may enter the approved Distinta by itself.
          const userMessage = page.getByTestId("commercial-rfq-user-message").first();
          await userMessage.waitFor({ state: "visible", timeout: 60000 });
          assert.match(await userMessage.innerText(), /40 tubi quadri 100x100x6/);
          await assertNoOverflow(page, "AI-first Distinta " + width);
          assert.match(await userMessage.innerText(), /S355J2H EN 10219 da 12 m/,
            "Original handoff must remain in the authenticated conversation");
          assert.equal(await page.getByTestId("commercial-ai-first").count(), 0,
            "Full dashboard assistant must be hidden in AI-focused compose");
          assert.equal(await page.getByTestId("commercial-list-pane").count(), 0,
            "Historical worklist must not crowd the AI review");
          assert.equal(await page.getByTestId("commercial-ai-focused-modes").count(), 0);
          assert.equal(await page.getByTestId("distinta-smart-box").count(), 1, "Exactly one input on the screen");
          assert.equal(await page.getByRole("tab").count(), 0, "Single column: no mobile tabs");
          assert.equal(await page.getByTestId("buyer-private-language-switch").count(), 0,
            "No full-width language bar on the single screen");
          assert.equal(await page.getByTestId("distinta-sheet").count(), 0,
            "No articles are imported before explicit AI analysis and human review");
          await page.screenshot({
            path: path.join(dir, "rfq-ai-preview-" + width + "px.png"),
            fullPage: false, animations: "disabled"
          });
          assert.equal(await page.locator("[data-private-calculator-toolbar]").count(), 0,
            "No separate calculator on the request screen (DISTINTA-QUICK1)");
          const analyzeAction = composer.getByRole("button", {
            name: /Analizza la richiesta con AI|Correggi proposta AI|Analisi in corso/
          });
          assert.equal(await analyzeAction.count(), 1,
            "One primary action is present even after an explicit AI intake");
          assert.ok(await analyzeAction.isVisible());
          await page.locator("#commercial-ai-intake").scrollIntoViewIfNeeded();
          // A Playwright "visible" element can still sit below the viewport.
          // Fail the visual gate unless the primary action is actually tappable
          // above the fixed mobile navigation without further scrolling.
          const ctaViewport = await analyzeAction.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom, height: window.innerHeight };
          });
          assert.ok(ctaViewport.top >= 0 &&
            ctaViewport.bottom <= ctaViewport.height - (width < 1000 ? 68 : 0),
            "AI Analyze CTA must appear in the first visible viewport at " + width + "px: " + JSON.stringify(ctaViewport));
          await page.screenshot({
            path: path.join(dir, "rfq-ai-first-" + width + "px.png"),
            fullPage: false, animations: "disabled"
          });
          // A bare size is a catalog search: suggestions, no AI call, nothing invented.
          await page.goto(base + "/commercial?compose=1&method=ai", {
            waitUntil: "domcontentloaded", timeout: 90000
          });
          const shortBox = page.getByTestId("distinta-smart-box");
          const shortField = page.locator("#distinta-smart-box");
          await shortField.waitFor({ state: "visible", timeout: 60000 });
          await page.locator('[data-private-calculator-page][data-buyer-draft-ready="true"]').waitFor({ timeout: 60000 });
          await shortField.fill("100x100x5");
          await shortBox.getByRole("option").first().waitFor({ state: "visible", timeout: 30000 });
          assert.equal(await shortBox.getByRole("button", { name: "Analizza la richiesta con AI" }).count(), 0,
            "A bare size never goes to the AI");
          assert.equal(await page.getByTestId("commercial-rfq-user-message").count(), 0);
          assert.equal(await page.getByTestId("distinta-sheet").count(), 0,
            "A search cannot invent articles or dispatch an RFQ");
          assert.equal(await shortField.inputValue(), "100x100x5");
          // COMM-RFQ-CREATE2: la calcolatrice separata non è più nella pagina di creazione richiesta.
          assert.equal(await page.getByTestId("commercial-ai-manual-tools-toggle").count(), 0);
          if (width !== 320) {
            // Old manual-entry links redirect to the same screen with the box focused.
            await page.goto(base + "/commercial?compose=1", { waitUntil: "domcontentloaded", timeout: 90000 });
            await page.waitForURL(url => url.pathname === "/rfq-hub/distinta" && url.searchParams.get("aggiungi") === "misura", { timeout: 60000 });
            const quick = page.getByTestId("distinta-smart-box");
            await quick.waitFor({ state: "visible", timeout: 60000 });
            await page.locator('[data-private-calculator-page][data-buyer-draft-ready="true"]').waitFor({ timeout: 60000 });
            // Fast path: size → quantity → Enter adds a complete row to the Distinta.
            const quickSearch = page.locator("#distinta-smart-box");
            await quickSearch.fill("100x100x5");
            await quick.getByRole("option").first().waitFor({ state: "visible", timeout: 30000 });
            await quickSearch.press("Enter");
            await page.waitForFunction(() => document.activeElement?.getAttribute("placeholder") === "Quantità", null, { timeout: 10000 });
            await page.keyboard.type("10");
            await page.keyboard.press("Enter");
            await page.getByTestId("distinta-sheet-lines").locator(":scope > li").first()
              .waitFor({ state: "visible", timeout: 30000 });
            assert.equal(await quickSearch.evaluate(el => el === document.activeElement), true,
              "After adding, the focus returns to the box for the next article");
            assert.equal(await page.getByTestId("commercial-rfq-ai-focused-header").count(), 0,
              "Manual New Request does not force an AI-focused screen");
          }
          console.log("COMM-RFQ-UX1 AI FIRST PASS", width);
        }
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
console.log("COMM-UX6.B FINAL LOCAL CHROME ACCEPTANCE PASS");
