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
// I vecchi parametri ?view=sent restano validi e aprono il segmento Acquisti.
async function inspectList(page, width, persona) {
  const href = "/commercial?view=sent&q=COMMUX6B";
  const response = await page.goto(base + href, { waitUntil: "domcontentloaded", timeout: 90000 });
  assert.equal(response?.status(), 200);
  await page.getByRole("heading", { name: "Trattative", exact: true, level: 1 })
    .waitFor({ state: "visible", timeout: 60000 });
  const purchase = page.getByTestId("commercial-deal-segments").getByRole("link", { name: /^Acquisti/ });
  assert.equal(await purchase.getAttribute("aria-current"), "page", "Legacy view=sent must open the Acquisti segment");
  const list = page.getByTestId("commercial-deals-list");
  await list.waitFor({ state: "visible", timeout: 60000 });
  const entries = list.getByTestId("commercial-deal-row");
  await entries.first().waitFor({ state: "visible", timeout: 60000 });
  const count = await entries.count();
  assert.equal(count, 8, "Expected exactly eight local RFQ deals, got " + count);
  // L'assistente resta sulla pagina ma chiuso: la tabella parte nel primo schermo.
  assert.equal(await page.getByTestId("commercial-ai-native-shell").isVisible(), false);
  let maxHeight = 0;
  for (let i = 0; i < count; i++) {
    const entry = entries.nth(i);
    const dimensions = await entry.boundingBox();
    assert.ok(dimensions, "Deal row " + i + " must have layout");
    assert.ok(dimensions.height >= 44 && dimensions.height <= (width === 1440 ? 80 : 180),
      "Deal row " + i + " is not compact at " + width + "px: " + dimensions.height);
    maxHeight = Math.max(maxHeight, dimensions.height);
    const text = await entry.innerText();
    assert.match(text, /COMMUX6B RFQ \d{2}/);
    assert.match(text, /Acquisto/);
    assert.match(text, /RFQ-[0-9A-F]{6}/);
    assert.match(text, /Bozza/);
    assert.match(text, /Completa e invia ai fornitori/);
    const destination = await entry.getAttribute("href") ?? "";
    assert.match(destination, /seg=purchase/);
    assert.match(destination, /item=campaign%3A|item=campaign:/);
    assert.doesNotMatch(destination, /view=/, "New rows must use the deal desk parameters");
  }
  const listText = await list.innerText();
  // Una riga per trattativa: le distinte già usate dalle RFQ non tornano come righe.
  assert.doesNotMatch(listText, /COMMUX6B Distinta/);
  assert.doesNotMatch(listText, /DEMOTEST23 PRODUCER PRIVATE RFQ/, "No cross-tenant records");
  if (width === 1440) {
    const first = await entries.first().boundingBox();
    const last = await entries.last().boundingBox();
    assert.ok(first && first.y < 420, "First deal must sit high in the desktop viewport: " + Math.round(first?.y ?? -1));
    assert.ok(first && last && last.y - first.y <= 8 * 80, "Rows must stay dense: " + Math.round((last?.y ?? 0) - (first?.y ?? 0)));
  }
  await assertNoOverflow(page, persona.id + " at " + width);
  await page.screenshot({
    path: path.join(dir, "worklist-" + persona.id + "-" + width + "px.png"),
    fullPage: false, animations: "disabled"
  });
  console.log("COMM-DEALS1 WORKLIST PASS", persona.id, width, "rows", count, "maxRowPx", maxHeight);
  return entries;
}

async function inspectViewer(page, width) {
  const response = await page.goto(base + "/commercial?view=sent&q=COMMUX6B", {
    waitUntil: "domcontentloaded", timeout: 90000
  });
  assert.equal(response?.status(), 200);
  await page.getByRole("heading", { name: "Trattative", exact: true, level: 1 })
    .waitFor({ state: "visible", timeout: 60000 });
  const list = page.getByTestId("commercial-deals-list");
  await list.waitFor({ state: "visible", timeout: 60000 });
  // A viewer is read-only; tenant RLS may deny campaign rows entirely.
  const count = await list.getByTestId("commercial-deal-row").count();
  assert.ok(count <= 8, "Viewer cannot gain synthetic records from other tenants");
  assert.doesNotMatch(await list.innerText(), /DEMOTEST23 PRODUCER PRIVATE RFQ/);
  assert.equal(await page.getByTestId("commercial-new-request").count(), 0);
  assert.equal(await page.getByTestId("comm-cine11-prompt").count(), 0);
  await assertNoOverflow(page, "viewer at " + width);
  await page.screenshot({
    path: path.join(dir, "read-only-viewer-" + width + "px.png"),
    fullPage: false, animations: "disabled"
  });
  console.log("COMM-DEALS1 READ-ONLY VIEWER PASS", width, "visibleRows", count);
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
        const content = detail.getByTestId("commercial-deal-detail");
        await content.getByRole("heading", { level: 2, name: /COMMUX6B RFQ \d{2}/ }).waitFor({ state: "visible" });
        const next = detail.getByTestId("commercial-deal-next-step");
        assert.match(await next.innerText(), /Completa e invia ai fornitori/);
        const documents = detail.getByTestId("commercial-deal-documents");
        assert.match(await documents.innerText(), /RFQ ai fornitori/);
        assert.match(await documents.innerText(), /Bozza/);
        // Righe articolo: norma, grado e quantità della distinta originale, nessun prezzo.
        const detailText = await detail.innerText();
        assert.match(detailText, /(?:SHS 100x100x5|RHS 200x100x6)/);
        assert.match(detailText, /EN 10219 · S355J2H/);
        assert.doesNotMatch(detailText, /DEMO Steel Manufacturing/);
        assert.doesNotMatch(detailText, /€/);
        // Una bozza resta sul documento originale: nessun salto a confronto o ordini.
        const primary = detail.getByTestId("commercial-deal-primary-action");
        const draftTarget = await primary.getAttribute("href");
        assert.ok(draftTarget && draftTarget.startsWith("/rfq-hub/") && !draftTarget.includes("#commercial-operations") && !draftTarget.includes("tab="),
          "Draft RFQ CTA must remain on the governed original document: " + draftTarget);
        const actualColors = await primary.evaluate(el => ({
          foreground: getComputedStyle(el).color,
          fill: getComputedStyle(el).webkitTextFillColor
        }));
        assert.equal(actualColors.foreground, "rgb(255, 255, 255)", "Selected deal CTA must be white on green");
        assert.equal(actualColors.fill, "rgb(255, 255, 255)", "Selected deal CTA WebKit text fill must be white");
        assert.equal(await detail.getByTestId("commercial-deal-next-step").locator("button").count(), 0,
          "The next-step summary never executes RFQ/PO operations");

        await assertNoOverflow(page, "selected deal " + width);
        await detail.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: path.join(dir, "deal-detail-" + persona.id + "-" + width + "px.png"),
          fullPage: false, animations: "disabled"
        });
        await detail.getByRole("link", { name: "Chiudi il dettaglio" }).click();
        await page.waitForURL(u => !u.searchParams.has("item"), { timeout: 60000 });
        assert.equal(await page.getByTestId("commercial-deals-list").getByTestId("commercial-deal-row").count(), 8,
          "Closing the detail must keep segment and search");
        if (persona.id === "buyer") {
          const alien = "/commercial?view=sent&q=COMMUX6B&item=campaign:" + producer.rfq;
          await page.goto(base + alien, { waitUntil: "domcontentloaded", timeout: 90000 });
          await page.getByTestId("commercial-deal-not-found").waitFor({ state: "visible", timeout: 60000 });
          assert.equal(await page.locator("#commercial-detail").count(), 0);

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
          const textField = page.locator("#rfqai2-text-input");
          await textField.waitFor({ state: "visible", timeout: 60000 });
          const conversation = page.getByTestId("commercial-rfq-gpt-conversation");
          const composer = page.getByTestId("commercial-rfq-sticky-composer");
          await conversation.waitFor({ state: "visible", timeout: 60000 });
          assert.ok(await composer.isVisible(), "The AI-focused route must render a sticky chat composer");
          assert.equal(await page.locator("[data-rfqai-original-request]").count(), 0,
            "The legacy form accordion must not appear in focused conversational mode");
          // The buyer explicitly clicked "Analizza con l'AI" on Commerciale.
          // The focused conversation therefore receives one authenticated
          // request, while no proposal may enter the approved Distinta by itself.
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
          // DISTINTA-QUICK1: no AI/manual switch; one «Aggiungi articolo» bar above the chat.
          assert.equal(await page.getByTestId("commercial-ai-focused-modes").count(), 0);
          assert.equal(await page.getByTestId("distinta-quick-add").count(), 1);
          const workspace = page.getByTestId("commercial-rfq-chat-workspace");
          await workspace.waitFor({ state: "visible" });
          assert.equal(await page.getByTestId("commercial-rfq-approved-lines").getByRole("listitem").count(), 0,
            "No articles are imported before explicit AI analysis and human review");
          // An explicit AI click on the home may already return review-only
          // proposals; approved articles and outbound RFQ actions remain empty.
          if (width === 1440) {
            assert.ok(await page.getByTestId("commercial-rfq-conversation-pane").isVisible());
            assert.ok(await page.getByTestId("commercial-rfq-preview-pane").isVisible());
          } else {
            await page.getByRole("tab", { name: /Distinta/ }).click();
            await page.getByTestId("commercial-rfq-preview-pane").waitFor({ state: "visible" });
            // The latest private bill preview displays a canonical empty-state
            // message; AI suggestions are separate from approved lines.
            assert.match(await page.getByTestId("commercial-rfq-live-preview").innerText(), /Ancora nessun articolo/);
            assert.equal(await page.getByTestId("commercial-rfq-approved-lines").getByRole("listitem").count(), 0,
              "Chat proposals must not auto-approve any Distinta line");
            await page.screenshot({
              path: path.join(dir, "rfq-ai-preview-" + width + "px.png"),
              fullPage: false, animations: "disabled"
            });
            const previewTab = page.getByRole("tab", { name: /Distinta/ });
            await previewTab.focus();
            await previewTab.press("ArrowLeft");
            assert.equal(await page.getByRole("tab", { name: "Conversazione" }).getAttribute("aria-selected"), "true",
              "Keyboard ArrowLeft must restore the conversation");
            assert.ok(await page.getByTestId("commercial-rfq-conversation-pane").isVisible());
            assert.ok(await textField.isVisible(),
              "Keyboard tab switching must restore the canonical composer");
            assert.match(await userMessage.innerText(), /40 tubi quadri/,
              "The original request must remain in the conversation");
            await page.getByRole("tab", { name: "Conversazione" }).press("End");
            assert.equal(await previewTab.getAttribute("aria-selected"), "true",
              "Keyboard End must select the Distinta preview");
            await previewTab.press("Home");
            assert.equal(await page.getByRole("tab", { name: "Conversazione" }).getAttribute("aria-selected"), "true",
              "Keyboard Home must select the conversation");
          }
          assert.equal(await page.locator("[data-private-calculator-toolbar]").count(), 0,
            "No separate calculator on the request screen (DISTINTA-QUICK1)");
          const analyzeAction = composer.getByRole("button", {
            name: /Analizza la richiesta con AI|Correggi proposta AI|Completa richiesta|Analisi in corso/
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
          // A bare shorthand must produce a safe clarification instead of
          // silently guessing a grade, norm, form or quantity from "100x100x5".
          // A new unsubmitted compose route is needed: the prior home click
          // already started an AI review and its input is in correction mode.
          await page.goto(base + "/commercial?compose=1&method=ai", {
            waitUntil: "domcontentloaded", timeout: 90000
          });
          const shortChat = page.getByTestId("commercial-rfq-gpt-conversation");
          const shortField = page.locator("#rfqai2-text-input");
          await shortField.waitFor({ state: "visible", timeout: 60000 });
          await shortField.fill("100x100x5");
          await shortChat.getByRole("button", { name: "Completa richiesta" }).click();
          await shortChat.getByTestId("commercial-rfq-user-message").first()
            .waitFor({ state: "visible", timeout: 60000 });
          assert.equal(await shortChat.getByTestId("commercial-rfq-user-message").count(), 1);
          assert.equal(await shortChat.getByTestId("commercial-rfq-assistant-message").count(), 1);
          assert.match(await shortChat.getByTestId("commercial-rfq-assistant-message").last().innerText(),
            /tipo di tubo, quantità e lunghezza/);
          assert.equal(await shortChat.getByTestId("commercial-rfq-ai-proposals").count(), 0,
            "A local clarification cannot invent AI candidates or dispatch an RFQ");
          assert.equal(await shortField.inputValue(), "100x100x5",
            "Keep shorthand text available for the buyer to complete it");
          // COMM-RFQ-CREATE2: la calcolatrice separata non è più nella pagina di creazione richiesta.
          assert.equal(await page.getByTestId("commercial-ai-manual-tools-toggle").count(), 0);
          if (width !== 320) {
            // Old manual-entry links redirect to the same screen with «Aggiungi articolo» focused.
            await page.goto(base + "/commercial?compose=1", { waitUntil: "domcontentloaded", timeout: 90000 });
            await page.waitForURL(url => url.pathname === "/rfq-hub/distinta" && url.searchParams.get("aggiungi") === "misura", { timeout: 60000 });
            await page.getByTestId("distinta-quick-add").waitFor({ state: "visible", timeout: 60000 });
            // Fast path: size → quantity → Enter adds a complete row to the Distinta.
            const quickSearch = page.locator("#distinta-quick-add-search");
            await quickSearch.fill("100x100x5");
            await page.getByTestId("distinta-quick-add").getByRole("option").first().waitFor({ state: "visible", timeout: 30000 });
            await quickSearch.press("Enter");
            await page.waitForFunction(() => document.activeElement?.getAttribute("placeholder") === "Q.tà", null, { timeout: 10000 });
            await page.keyboard.type("10");
            await page.keyboard.press("Enter");
            // On mobile the Distinta column sits in a hidden tab: include hidden nodes.
            await page.getByTestId("commercial-rfq-approved-lines").getByRole("listitem", { includeHidden: true }).first()
              .waitFor({ state: "attached", timeout: 30000 });
            assert.equal(await quickSearch.evaluate(el => el === document.activeElement), true,
              "After adding, the focus returns to the search for the next article");
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
