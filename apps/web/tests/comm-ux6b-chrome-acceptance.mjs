/**
 * COMM-UX6.B — authenticated Professional Deal Workspace visual acceptance.
 * Only disposable FLOW1 Supabase/Next; eight locally seeded private campaigns.
 * Never accesses production data, sends supplier email or calls external URLs.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

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
  await page.getByRole("heading", { name: "Oggi in " + persona.name, exact: true })
    .waitFor({ state: "visible", timeout: 60000 });
}
async function assertNoOverflow(page, name) {
  const size = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }));
  assert.ok(size.scroll <= size.client + 12, name + " has horizontal overflow: " + JSON.stringify(size));
}
async function inspectList(page, width, persona) {
  const href = "/commercial?view=sent&q=COMMUX6B";
  const response = await page.goto(base + href, { waitUntil: "domcontentloaded", timeout: 90000 });
  assert.equal(response?.status(), 200);
  const heading = page.getByRole("heading", { name: "Le mie trattative", exact: true });
  await heading.waitFor({ state: "visible", timeout: 60000 });
  assert.equal(await page.getByText("Trattative e attività", { exact: true }).count(), 0,
    "Duplicate worklist sub-heading must not return");
  const header = page.getByTestId("comm-cine9-workspace-heading");
  const list = page.getByTestId("commercial-list-pane");
  await list.waitFor({ state: "visible", timeout: 60000 });
  const entries = list.locator("div.divide-y > a");
  await entries.first().waitFor({ state: "visible", timeout: 60000 });
  const count = await entries.count();
  assert.equal(count, 8, "Expected exactly eight local RFQ density entries, got " + count);
  const headerRect = await header.boundingBox();
  assert.ok(headerRect && headerRect.height <= 90, "Second header must remain compact: " + headerRect?.height);
  let maxHeight = 0;
  for (let i = 0; i < count; i++) {
    const entry = entries.nth(i);
    const dimensions = await entry.boundingBox();
    assert.ok(dimensions, "Deal row " + i + " must have layout");
    assert.ok(dimensions.height >= 44 && dimensions.height <= (width === 1440 ? 86 : 148),
      "Deal row " + i + " is not compact at " + width + "px: " + dimensions.height);
    maxHeight = Math.max(maxHeight, dimensions.height);
    const title = entry.locator('[data-testid="commercial-smart-deal-card"] p[title]');
    assert.match(await title.getAttribute("title") ?? "", /COMMUX6B RFQ \d{2}/);
    assert.match(await entry.innerText(), /RFQ ai fornitori/i);
    assert.match(await entry.innerText(), /Bozza/i);
    const destination = await entry.getAttribute("href") ?? "";
    assert.match(destination, /view=sent/);
    assert.match(destination, /item=campaign%3A|item=campaign:/);
  }
  const listText = await list.innerText();
  assert.doesNotMatch(listText, /DEMOTEST23 PRODUCER PRIVATE RFQ/, "No cross-tenant records");
  await assertNoOverflow(page, persona.id + " at " + width);
  await list.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(dir, "worklist-" + persona.id + "-" + width + "px.png"),
    fullPage: false, animations: "disabled"
  });
  if (width === 1440) {
    const first = await entries.first().boundingBox();
    const last = await entries.last().boundingBox();
    assert.ok(first && last && last.y + last.height <= 910, "Eight deals must be readable in one desktop viewport after scrolling");
  }
  console.log("COMM-UX6.B WORKLIST PASS", persona.id, width, "rows", count, "maxRowPx", maxHeight);
  return entries;
}

async function inspectViewer(page, width) {
  const response = await page.goto(base + "/commercial?view=sent&q=COMMUX6B", {
    waitUntil: "domcontentloaded", timeout: 90000
  });
  assert.equal(response?.status(), 200);
  await page.getByRole("heading", { name: "Le mie trattative", exact: true })
    .waitFor({ state: "visible", timeout: 60000 });
  const list = page.getByTestId("commercial-list-pane");
  await list.waitFor({ state: "visible", timeout: 60000 });
  // A viewer is read-only; tenant RLS may deny campaign rows entirely.
  // The density fixture is only for the buyer role and must NOT assume viewer grants.
  const rows = list.locator("div.divide-y > a");
  const count = await rows.count();
  assert.ok(count <= 8, "Viewer cannot gain synthetic records from other tenants");
  assert.doesNotMatch(await list.innerText(), /DEMOTEST23 PRODUCER PRIVATE RFQ/);
  assert.equal(await page.getByRole("link", { name: "+ Nuova richiesta" }).count(), 0);
  assert.equal(await page.getByTestId("comm-cine11-prompt").count(), 0);
  await assertNoOverflow(page, "viewer at " + width);
  await list.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(dir, "read-only-viewer-" + width + "px.png"),
    fullPage: false, animations: "disabled"
  });
  console.log("COMM-UX6.B READ-ONLY VIEWER PASS", width, "visibleRows", count);
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
        const entries = await inspectList(page, width, persona);
        const firstUrl = await entries.first().getAttribute("href");
        assert.ok(firstUrl);
        await entries.first().click();
        await page.waitForURL(u => u.searchParams.has("item"), { timeout: 60000 });
        const detail = page.locator("#commercial-detail");
        await detail.waitFor({ state: "visible", timeout: 60000 });
        await detail.getByRole("heading", { name: "Trattativa selezionata" }).waitFor({ state: "visible" });
        const intelligence = detail.getByTestId("commercial-deal-intelligence");
        await intelligence.waitFor({ state: "visible", timeout: 60000 });
        await intelligence.getByRole("heading", { name: "Il quadro della trattativa" })
          .waitFor({ state: "visible" });
        const readiness = detail.getByTestId("commercial-decision-readiness");
        await readiness.getByRole("heading", { name: "Prima di decidere" })
          .waitFor({ state: "visible" });
        const readinessRect = await readiness.boundingBox();
        const actionRect = await detail.getByTestId("commercial-deal-next-step").boundingBox();
        const factsRect = await intelligence.boundingBox();
        assert.ok(readinessRect && actionRect && factsRect &&
          readinessRect.y < actionRect.y && actionRect.y < factsRect.y,
          "Decision checks and next action must appear before the detailed commercial facts");
        const advice = await readiness.innerText();
        assert.match(advice, /Da confermare:/);
        assert.match(advice, /Conferma i destinatari nella RFQ originale/);
        assert.match(advice, /Controlla scadenze e condizioni/);
        assert.match(advice, /non una validazione automatica/);
        assert.equal(await readiness.locator("button").count(), 0,
          "Decision checklist must not execute RFQ/PO operations");
        const materialText = await intelligence.getByTestId("commercial-deal-materials").innerText();
        assert.match(materialText, /(?:SHS 100x100x5|RHS 200x100x6)/);
        assert.match(materialText, /EN 10219/);
        assert.match(materialText, /S355J2H/);
        const sourceText = await intelligence.getByTestId("commercial-deal-sources").innerText();
        assert.match(sourceText, /RFQ e documenti originali/);
        assert.match(sourceText, /Distinta privata originale/);
        assert.doesNotMatch(await intelligence.innerText(), /DEMO Steel Manufacturing/);
        await detail.getByRole("heading", { name: "Completa la RFQ e verifica i fornitori" })
          .waitFor({ state: "visible" });

        const continueAction = detail.getByTestId("commercial-deal-next-step").getByRole("link");
        await continueAction.waitFor({ state: "visible" });
        // COMM-UX7.C: reuse a single decision surface and never jump from a
        // synthetic draft campaign directly into comparison/PO execution.
        const decisionDock = detail.getByTestId("commercial-decision-dock");
        assert.equal(await decisionDock.count(), 1);
        assert.ok(await decisionDock.getByTestId("commercial-decision-readiness").isVisible());
        const draftTarget = await detail.getByTestId("commercial-deal-primary-action").getAttribute("href");
        assert.ok(draftTarget && !draftTarget.includes("#commercial-operations") && !draftTarget.includes("tab="),
          "Draft RFQ CTA must remain on the governed original document");
        const actualColors = await continueAction.evaluate(el => ({
          foreground: getComputedStyle(el).color,
          fill: getComputedStyle(el).webkitTextFillColor
        }));
        assert.equal(actualColors.foreground, "rgb(255, 255, 255)", "Selected deal CTA must be white on green");
        assert.equal(actualColors.fill, "rgb(255, 255, 255)", "Selected deal CTA WebKit text fill must be white");

        await assertNoOverflow(page, "selected deal " + width);
        await detail.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: path.join(dir, "deal-detail-" + persona.id + "-" + width + "px.png"),
          fullPage: false, animations: "disabled"
        });
        await detail.getByRole("link", { name: /Chiudi/ }).click();
        await page.waitForURL(u => !u.searchParams.has("item"), { timeout: 60000 });
        assert.equal(await page.getByTestId("commercial-list-pane").locator("div.divide-y > a").count(), 8,
          "Closing selected detail must retain filtered worklist");
        if (persona.id === "buyer") {
          const alien = "/commercial?view=sent&q=COMMUX6B&item=campaign:" + producer.rfq;
          await page.goto(base + alien, { waitUntil: "domcontentloaded", timeout: 90000 });
          await page.getByRole("status").filter({ hasText: "Attività non trovata" })
            .waitFor({ state: "visible", timeout: 60000 });
          assert.equal(await page.locator("#commercial-detail").count(), 0);

          // COMM-RFQ-UX1: actual authenticated browser handoff. The text
          // must appear before the calculator without any implicit AI call.
          await page.goto(base + "/commercial", { waitUntil: "domcontentloaded", timeout: 90000 });
          const input = page.getByLabel("Descrivi il materiale", { exact: true });
          await input.fill("40 tubi quadri 100x100x6 S355J2H EN 10219 da 12 m");
          await page.getByTestId("commercial-ai-first-cta").click();
          await page.waitForURL(url => url.searchParams.get("compose") === "1" &&
            url.searchParams.get("method") === "ai", { timeout: 60000 });
          const focused = page.getByTestId("commercial-rfq-ai-focused-header");
          await focused.waitFor({ state: "visible", timeout: 60000 });
          const textField = page.locator("#rfqai2-text-input");
          await textField.waitFor({ state: "visible", timeout: 60000 });
          const conversation = page.getByTestId("commercial-rfq-gpt-conversation");
          const composer = page.getByTestId("commercial-rfq-sticky-composer");
          await conversation.waitFor({ state: "visible", timeout: 60000 });
          assert.ok(await composer.isVisible(), "The AI-focused route must render a sticky chat composer");
          assert.equal(await page.locator("[data-rfqai-original-request]").count(), 0,
            "The legacy form accordion must not appear in focused conversational mode");
          assert.equal(await page.getByTestId("commercial-rfq-user-message").count(), 0,
            "Opening the compose route must not implicitly submit text or call AI");
          await assertNoOverflow(page, "AI-first Distinta " + width);
          assert.equal(await textField.inputValue(), "40 tubi quadri 100x100x6 S355J2H EN 10219 da 12 m");
          assert.equal(await page.getByTestId("commercial-ai-first").count(), 0,
            "Full dashboard assistant must be hidden in AI-focused compose");
          assert.equal(await page.getByTestId("commercial-list-pane").count(), 0,
            "Historical worklist must not crowd the AI review");
          assert.equal(await page.getByTestId("commercial-ai-focused-modes").count(), 1);
          const workspace = page.getByTestId("commercial-rfq-chat-workspace");
          await workspace.waitFor({ state: "visible" });
          assert.equal(await page.getByTestId("commercial-rfq-approved-lines").getByRole("listitem").count(), 0,
            "No articles are imported before explicit AI analysis and human review");
          assert.equal(await page.getByTestId("commercial-rfq-ai-proposals").count(), 0,
            "AI proposals must remain empty until the explicit Analyze click");
          if (width === 1440) {
            assert.ok(await page.getByTestId("commercial-rfq-conversation-pane").isVisible());
            assert.ok(await page.getByTestId("commercial-rfq-preview-pane").isVisible());
          } else {
            await page.getByRole("tab", { name: /Distinta/ }).click();
            await page.getByTestId("commercial-rfq-preview-pane").waitFor({ state: "visible" });
            assert.match(await page.getByTestId("commercial-rfq-live-preview").innerText(), /Nessun articolo confermato/);
            await page.screenshot({
              path: path.join(dir, "rfq-ai-preview-" + width + "px.png"),
              fullPage: false, animations: "disabled"
            });
            await page.getByRole("tab", { name: "Conversazione" }).click();
            assert.equal(await textField.inputValue(), "40 tubi quadri 100x100x6 S355J2H EN 10219 da 12 m",
              "Switching mobile views must not unmount the draft input");
          }
          const manualShell = page.locator("#commercial-rfq-manual-tools");
          assert.equal(await manualShell.isVisible(), false,
            "Calculator must initially be a secondary action");
          const analyzeAction = page.getByRole("button", { name: "Analizza la richiesta con AI" });
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
          // A bare shorthand must produce a safe clarification instead of
          // silently guessing a grade, norm, form or quantity from "100x100x5".
          await textField.fill("100x100x5");
          await page.getByRole("button", { name: "Completa richiesta" }).click();
          assert.equal(await page.getByTestId("commercial-rfq-user-message").count(), 1);
          assert.equal(await page.getByTestId("commercial-rfq-assistant-message").count(), 1);
          assert.match(await page.getByTestId("commercial-rfq-assistant-message").last().innerText(),
            /tipo di tubo, quantità e lunghezza/);
          assert.equal(await page.getByTestId("commercial-rfq-ai-proposals").count(), 0,
            "Local clarification must not invent AI candidates or send a request");
          assert.equal(await textField.inputValue(), "100x100x5",
            "Keep shorthand text available for the buyer to complete it");
          await page.getByTestId("commercial-ai-manual-tools-toggle").click();
          await manualShell.waitFor({ state: "visible" });
          assert.ok(await manualShell.getByText("Articoli in distinta", { exact: true }).isVisible(),
            "Manual calculator remains accessible without leaving the workflow");
          if (width !== 320) {
            await page.goto(base + "/commercial?compose=1", { waitUntil: "domcontentloaded", timeout: 90000 });
            await page.locator("#commercial-rfq-manual-tools").waitFor({ state: "visible", timeout: 60000 });
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
