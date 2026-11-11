/**
 * COMM-UX6.A — synthetic Chrome acceptance for the first viewport and the
 * explicit AI → private Distinta text handoff. Uses only FLOW1 disposable
 * local Supabase users and Next.js. Never operates on production or Vercel.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
const homeHeading = (name) => new RegExp("^(Buongiorno|Buonasera), " + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"); // HOME-FIRSTRUN1B title

const base = process.env.DEMOTEST23_WEB_URL;
assert.equal(base, "http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true");
assert.ok(process.env.RUNNER_TEMP);
const personas = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "demotest23-personas.json"), "utf8"));
const buyer = personas.find(p => p.id === "buyer");
const viewer = personas.find(p => p.id === "buyerViewer");
assert.ok(buyer && viewer);
const screenshotsDir = path.join(process.env.RUNNER_TEMP, "comm-ux6a-visual-evidence");
mkdirSync(screenshotsDir, { recursive: true });

async function login(page, p) {
  await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator('input[name="email"]').fill(p.email);
  await page.locator('input[name="password"]').fill(p.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(u => u.pathname === "/dashboard", { timeout: 90000 });
  await page.getByRole("heading", { name: homeHeading(p.name) })
    .waitFor({ state: "visible", timeout: 60000 });
}
async function noOverflow(page, tag) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(widths.document <= widths.viewport + 12, tag + " horizontal overflow: " + JSON.stringify(widths));
}
async function viewportCheck(page, { width, height, role }) {
  // COMM-AI-NATIVE1.B: protect the current classic Commerciale experience.
  // COMM-SIMPLE2 moved tools into a closed disclosure; COMM-NAV9 made
  // "Da verificare" conditional rather than an always-visible dashboard.
  await page.goto(base + "/commercial?experience=classic", {
    waitUntil: "domcontentloaded", timeout: 90000,
  });
  const heading = page.getByTestId("comm-cine1-hero");
  const creation = page.getByTestId("comm-cine13-first-workspace");
  const companion = page.getByTestId("commercial-ai-first");
  const tools = page.getByTestId("commercial-primary-quick-actions");
  const worklist = page.getByTestId("comm-cine2-deal-cockpit");
  await heading.waitFor({ state: "attached", timeout: 60000 });
  assert.equal(await heading.evaluate(node => node.tagName), "H1",
    "Classic Commerciale must retain its native screen-reader heading");
  await creation.waitFor({ state: "visible", timeout: 60000 });
  await companion.waitFor({ state: "visible" });
  await tools.waitFor({ state: "visible" });
  await worklist.waitFor({ state: "attached" });
  assert.equal(await page.getByTestId("commercial-ai-native-shell").count(), 0,
    "Classic rollback cannot silently show AI-native shell");
  const [creationBox, companionBox, toolsBox, worklistBox] = await Promise.all(
    [creation, companion, tools, worklist].map(element => element.boundingBox())
  );
  assert.ok([creationBox, companionBox, toolsBox, worklistBox].every(Boolean),
    "Classic Commerciale must retain creation, AI intake, tools and deals");
  assert.ok(creationBox.y <= companionBox.y + companionBox.height &&
    creationBox.y < toolsBox.y && toolsBox.y < worklistBox.y,
    "Existing worklist and tool order must remain stable");

  const alerts = page.getByTestId("commercial-compact-actions");
  if (await alerts.count()) {
    assert.equal(role, "buyer",
      "Read-only viewers cannot receive actionable procurement priorities");
    const alertBox = await alerts.boundingBox();
    assert.ok(alertBox && alertBox.y < creationBox.y,
      "Confirmed actionable work precedes the creation workspace");
    assert.equal(await alerts.getByRole("link", { name: "Apri inbox →" }).count(), 1);
    assert.equal(await alerts.getByTestId("commercial-director-attention-summary").count(), 1);
  }
  if (role === "buyerViewer") assert.equal(await alerts.count(), 0);
  assert.equal(await page.getByTestId("commercial-cockpit-tabs").count(), 0);
  await noOverflow(page, role + "/" + width);

  // Calculator, saved Distinte and history live in the secondary Strumenti
  // disclosure: open it before asserting interactive controls are visible.
  assert.match(await tools.locator("summary").innerText(), /Strumenti/);
  await tools.locator("summary").click();
  const calculator = page.getByRole("button", { name: "Calcolatrice pesi" });
  await calculator.waitFor({ state: "visible" });
  assert.equal(await page.locator('[data-commercial-saved-distinte-entry="true"]').count(), 1);
  assert.ok(await page.locator('[data-commercial-saved-distinte-entry="true"]').isVisible());
  const history = page.getByTestId("commercial-history-entry");
  assert.ok(await history.isVisible());
  assert.ok((await history.getAttribute("href"))?.startsWith("/commercial/search"));

  const canWrite = role === "buyer";
  const manual = page.getByTestId("commercial-manual-entry");
  assert.equal(await manual.count(), canWrite ? 1 : 0);
  assert.equal(await companion.getByTestId("comm-cine11-prompt").count(), canWrite ? 1 : 0);
  assert.equal(await page.getByRole("link", { name: "+ Nuova richiesta" }).count(), 0);
  if (canWrite) {
    assert.equal(await manual.getAttribute("href"), "/commercial?compose=1#commercial-compose");
    const cta = companion.getByTestId("commercial-ai-first-cta");
    assert.equal(await cta.count(), 1);
    assert.equal(await cta.isDisabled(), true);
    assert.match(await cta.innerText(), /Analizza con l’AI/);
  }
  if (width === 1440 && canWrite) {
    await calculator.click();
    await page.getByRole("dialog", { name: "Calcolatrice e distinta commerciale" })
      .waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  }
  await page.screenshot({
    path: path.join(screenshotsDir, "commercial-" + role + "-" + width + "px.png"),
    fullPage: false, animations: "disabled",
  });
  console.log("COMM-UX6.A CLASSIC VISUAL PASS", role, width, {
    creationY: creationBox.y, worklistY: worklistBox.y, toolsY: toolsBox.y,
  });
}

/** COMM-TRUST1.A/B: real browser checks, not a source-only assertion. */
async function calculatorTrustCheck(page, width) {
  const launch = page.getByRole("button", { name: "Calcolatrice pesi" });
  await launch.click();
  const panel = page.locator("[data-commercial-calculator-panel]");
  await panel.waitFor({ state: "visible" });
  const bars = panel.locator('[aria-label="Numero barre"]');
  const length = panel.locator('[aria-label="Lunghezza barra personalizzata"]');
  const price = panel.locator('[aria-label="Prezzo €/t"]');
  await bars.fill("4");
  await length.fill("8");
  await price.fill("1115");
  await panel.getByRole("button", { name: /Aggiungi alla distinta/ }).click();

  const trigger = page.getByTestId("calculator-cart-trigger");
  await trigger.waitFor({ state: "visible" });
  await trigger.click();
  const cart = page.locator("#distinta-inline-dialog");
  await cart.waitFor({ state: "visible" });
  const title = cart.locator('[aria-label="Nome distinta"]');
  await title.fill("COMM-TRUST1 verifica");
  await page.screenshot({ path: path.join(screenshotsDir, `commercial-calculator-cart-${width}px.png`), fullPage: false, animations: "disabled" });
  assert.equal(await cart.locator("[data-distinta-compact-row]").count(), 1,
    "One added measure should generate only one bill row");

  // First Escape closes the nested portal, not its parent.
  await page.keyboard.press("Escape");
  await cart.waitFor({ state: "hidden" });
  assert.ok(await panel.isVisible(), "Nested Escape must leave the calculator open");
  await page.screenshot({ path: path.join(screenshotsDir, `commercial-calculator-open-${width}px.png`), fullPage: false, animations: "disabled" });
  assert.ok(await trigger.isVisible(), "Bill trigger must regain keyboard access");

  // The portal trigger is deliberately in the parent Tab loop.
  const close = panel.getByRole("button", { name: "Chiudi", exact: true });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(await trigger.evaluate(el => document.activeElement === el), true,
    "Shift+Tab from the first parent control must reach the floating bill trigger");
  await page.keyboard.press("Tab");
  assert.equal(await close.evaluate(el => document.activeElement === el), true,
    "Tab from the floating bill trigger must wrap to the calculator close control");

  await close.click();
  await panel.waitFor({ state: "hidden" });
  assert.equal(await trigger.isVisible(), false, "Parked calculator must hide its floating cart");
  assert.equal(await launch.evaluate(el => document.activeElement === el), true,
    "Closing the parent must return focus to the launcher");
  await launch.click();
  await panel.waitFor({ state: "visible" });
  assert.equal(await bars.inputValue(), "4");
  assert.equal(await length.inputValue(), "8");
  assert.equal(await price.inputValue(), "1115",
    "Unsaved commercial price stays in memory, never a new shared-storage draft");

  await trigger.click();
  await cart.waitFor({ state: "visible" });
  assert.equal(await title.inputValue(), "COMM-TRUST1 verifica");
  assert.equal(await cart.locator("[data-distinta-compact-row]").count(), 1,
    "Reopening must not duplicate a previously added line");
  await page.keyboard.press("Escape");
  await cart.waitFor({ state: "hidden" });
  await page.keyboard.press("Escape");
  await panel.waitFor({ state: "hidden" });
  console.log("COMM-TRUST1.A/B PASS", width);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [1440, 390, 320]) {
    for (const p of [buyer, viewer]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 1440 ? 900 : width === 390 ? 844 : 720 },
        isMobile: width < 1000, deviceScaleFactor: width < 1000 ? 2 : 1,
        locale: "it-IT", reducedMotion: "reduce"
      });
      try {
        const page = await context.newPage();
        await login(page, p);
        await viewportCheck(page, { width, height: width === 1440 ? 900 : width === 390 ? 844 : 720, role: p.id });
        if (p.id === "buyer") await calculatorTrustCheck(page, width);
        if (p.id === "buyer") {
          const sample = "40 tubi quadri 100×100×5 S355J2H EN 10219, 6 m";
          const input = page.locator("#commercial-ai-companion-input");
          await input.fill(sample);
          await input.press("Shift+Enter");
          assert.ok((await input.inputValue()).includes("\n"),
            "Shift+Enter must add a line without leaving the home composer");
          assert.equal(new URL(page.url()).searchParams.get("compose"), null);
          await input.fill(sample);
          if (width === 390) await page.getByTestId("commercial-ai-first-cta").click();
          else await input.press("Enter");
          await page.waitForURL(u => u.pathname === "/commercial" && u.searchParams.get("compose") === "1", { timeout: 90000 });
          const draft = page.locator("#rfqai2-text-input");
          await draft.waitFor({ state: "visible", timeout: 60000 });
          await page.waitForFunction(expected => document.querySelector("#rfqai2-text-input")?.value === expected, sample);
          assert.equal(await draft.inputValue(), sample);
          assert.equal(await page.evaluate(() => sessionStorage.getItem("sss:commercial-ai-intake-handoff")), null);
          // COMM-RFQ-CREATE1: the home CTA explicitly starts the analysis,
          // so the focused GPT-like conversation may already show proposals
          // and change the submit button from Analizza to Correggi.
          const conversation = page.getByTestId("commercial-rfq-gpt-conversation");
          await conversation.waitFor({ state: "visible" });
          await conversation.getByTestId("commercial-rfq-sticky-composer").waitFor({ state: "visible" });
          await conversation.getByTestId("commercial-rfq-user-message").first().waitFor({ state: "visible" });
          assert.equal(await conversation.getByTestId("commercial-rfq-sticky-composer").count(), 1,
            "One canonical chat composer, not a duplicate AI analyzer");
          await page.screenshot({ path: path.join(screenshotsDir, `commercial-ai-to-private-distinta-${width}px.png`), fullPage: false, animations: "disabled" });
          console.log("COMM-TRUST1.D CHAT → PRIVATE DISTINTA PASS", width, "one-shot text, preview, no automatic analysis or dispatch");

          if (width === 1440) {
            // Explicitly exercise the manual alternative, not merely its href.
            await page.goto(base + "/commercial?experience=classic", { waitUntil: "domcontentloaded", timeout: 90000 });
            await page.getByTestId("commercial-manual-entry").click();
            await page.waitForURL(u => u.pathname === "/commercial" &&
              u.searchParams.get("compose") === "1" && u.searchParams.get("method") !== "ai", { timeout: 90000 });
            await page.locator("#commercial-compose").waitFor({ state: "visible", timeout: 60000 });
            assert.equal(await page.getByTestId("commercial-rfq-chat-workspace").count(), 0,
              "Manual entry must not silently start the AI conversation");
            console.log("COMM-TRUST1.D MANUAL ENTRY PASS");
          }

          // COMM-TRUST1.C: a no-match filter is not an empty archive or failed RPC.
          await page.goto(base + "/commercial?view=drafts&q=commtrust1cnomatch", { waitUntil: "domcontentloaded", timeout: 90000 });
          const empty = page.locator('[data-commercial-empty-state="filtered"]');
          await empty.waitFor({ state: "visible", timeout: 60000 });
          assert.match(await empty.innerText(), /Nessun risultato per questo filtro/);
          assert.equal(await empty.getByRole("link", { name: "Rimuovi filtro →" }).count(), 1);
          assert.equal(await page.locator('[aria-label="Pagine attività commerciali"]').count(), 0,
            "Do not show Page 1 when a filter has no results and no navigation");
          await page.screenshot({ path: path.join(screenshotsDir, `commercial-filtered-empty-${width}px.png`), fullPage: false, animations: "disabled" });
          console.log("COMM-TRUST1.C FILTERED EMPTY PASS");

        }
        // Explicitly verify historical retrieval for both roles at all widths.
        // Retrieval must never silently start an RFQ or the AI composer.
        // A navigation to a filtered view resets the disclosure; reopen the
        // real "Strumenti" menu before following the history link.
        const historyMenu = page.getByTestId("commercial-primary-quick-actions");
        if (!(await historyMenu.evaluate(element => element.hasAttribute("open")))) {
          await historyMenu.locator("summary").click();
        }
        await page.getByTestId("commercial-history-entry").click();
        await page.waitForURL(u => u.pathname === "/commercial/search", { timeout: 90000 });
        assert.equal(new URL(page.url()).searchParams.get("compose"), null);
        console.log("COMM-TRUST1.D HISTORY RETRIEVAL PASS", p.id, width);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
console.log("COMM-UX6.A AUTHENTICATED VISUAL ACCEPTANCE PASS");
