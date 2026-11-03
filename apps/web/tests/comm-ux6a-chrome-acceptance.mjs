/**
 * COMM-UX6.A — synthetic Chrome acceptance for the first viewport and the
 * explicit AI → private Distinta text handoff. Uses only FLOW1 disposable
 * local Supabase users and Next.js. Never operates on production or Vercel.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
const homeHeading = (name) => new RegExp("^(Buongiorno|Buonasera), " + name.replace(/[.*+?^${}()|[\]\\]/g, "\\import { chromium } from "playwright";") + "$"); // HOME-FIRSTRUN1B title

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
  await page.goto(base + "/commercial", { waitUntil: "domcontentloaded", timeout: 90000 });
  const hero = page.getByTestId("comm-cine1-hero");
  const companion = page.getByTestId("commercial-ai-first");
  const tools = page.getByTestId("commercial-primary-quick-actions");
  const attention = page.getByTestId("commercial-compact-actions");
  const worklist = page.getByTestId("comm-cine2-deal-cockpit");
  await hero.getByRole("heading", { level: 1 }).waitFor({ state: "visible", timeout: 60000 });
  await tools.waitFor({ state: "visible" });
  await worklist.waitFor({ state: "attached" });
  const [h, c, t, a, w] = await Promise.all(
    [hero, companion, tools, attention, worklist].map(x => x.boundingBox())
  );
  assert.ok([h, c, t, a, w].every(Boolean), "All first viewport surfaces should render");
  assert.ok(h.y < a.y && a.y < c.y && c.y < t.y && t.y < w.y,
    "COMM-NAV9.M director priorities precede AI and tools in visual and DOM order");
  assert.ok(await page.getByRole("button", { name: "Calcolatrice pesi" }).isVisible());
  // COMM-NAV9: a decision-first summary must remain compact, honest about
  // missing RFQ data and read-only for viewer roles.
  const priorities = page.getByTestId("commercial-director-rfq-priorities");
  const resume = page.getByTestId("commercial-director-resume");
  assert.equal(await priorities.count(), 1);
  assert.equal(await resume.count(), 1);
  assert.equal(await attention.getByRole("heading", { name: "Cosa richiede attenzione" }).count(), 1);
  const inboxLink = attention.getByRole("link", { name: "Apri inbox →" });
  assert.equal(await inboxLink.count(), 1);
  if (width < 1000) {
    const inboxBox = await inboxLink.boundingBox();
    assert.ok(inboxBox && inboxBox.y + inboxBox.height <= height,
      "COMM-NAV9.M priority inbox action must be inside the FIRST mobile viewport: " + JSON.stringify(inboxBox));
    const priorityBox = await attention.boundingBox();
    assert.ok(priorityBox && priorityBox.y < height / 1.5,
      "COMM-NAV9.M priority panel must start in the upper mobile viewport: " + JSON.stringify(priorityBox));
    const topVisualNodes = await page.evaluate(() => [
      document.querySelector("#commercial-today"),
      document.querySelector('[data-testid="comm-cine13-first-workspace"]'),
      document.querySelector("#commercial-tool-access"),
    ].map(x => x?.getBoundingClientRect().top));
    assert.ok(topVisualNodes.every(Number.isFinite) && topVisualNodes[0] < topVisualNodes[1] && topVisualNodes[1] < topVisualNodes[2],
      "Priority links must follow the natural keyboard/DOM order on mobile");
  }
  assert.equal(await attention.getByRole("link", { name: "Le mie trattative →" }).count(), 1);
  if (role === "buyerViewer") {
    assert.match(await priorities.innerText(), /Consultazione in sola lettura/);
    assert.equal(await priorities.getByTestId("commercial-director-attention-summary").count(), 0);
  } else {
    assert.equal(await priorities.getByTestId("commercial-director-attention-summary").count(), 1);
  }
  assert.ok(await page.locator('[data-commercial-saved-distinte-entry="true"]').isVisible(), "Saved Distinte CTA remains visible inside the cockpit");
  assert.equal(await page.getByTestId("commercial-cockpit-tabs").count(), 0);
  await noOverflow(page, role + "/" + width);
  if (width === 1440) {
    assert.ok(h.height <= 205, "Desktop hero must fit within 205px; got " + h.height);
    assert.ok(w.y < height, "Worklist heading should enter the first 900px viewport; y=" + w.y);
  }
  const canWrite = role === "buyer";
  if (width === 1440 && canWrite) {
    const firstDeal = page.getByTestId("commercial-smart-deal-card").first();
    const dealBox = await firstDeal.boundingBox();
    assert.ok(dealBox && dealBox.y < height,
      "COMM-NAV9: first deal row should begin inside 900px desktop viewport; y=" + dealBox?.y);
  }
  assert.equal(await companion.getByTestId("comm-cine11-prompt").count(), canWrite ? 1 : 0);
  // COMM-TRUST1.D — one conversational composer, no second primary "new request".
  const manual = page.getByTestId("commercial-manual-entry");
  const history = page.getByTestId("commercial-history-entry");
  assert.equal(await manual.count(), canWrite ? 1 : 0);
  assert.equal(await history.count(), 1);
  assert.equal(await page.getByRole("link", { name: "+ Nuova richiesta" }).count(), 0);
  assert.ok((await history.getAttribute("href"))?.startsWith("/commercial/search"),
    "History is retrieval, never an AI or Distinta handoff");
  if (canWrite) {
    assert.equal(await manual.getAttribute("href"), "/commercial?compose=1#commercial-compose");
    const cta = companion.getByTestId("commercial-ai-first-cta");
    assert.equal(await cta.count(), 1);
    assert.equal(await cta.isDisabled(), true);
    assert.match(await cta.innerText(), /Apri chat e anteprima/);
  }
  if (width === 1440 && canWrite) {
    const launch = page.getByRole("button", { name: "Calcolatrice pesi" });
    await launch.click();
    await page.getByRole("dialog", { name: "Calcolatrice e distinta commerciale" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  }
  const filename = `commercial-${role}-${width}px.png`;
  await page.screenshot({ path: path.join(screenshotsDir, filename), fullPage: false, animations: "disabled" });
  console.log("COMM-UX6.A VISUAL PASS", role, width, { heroHeight: h.height, worklistY: w.y, quickActionsY: t.y });
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
    for (const p of width === 320 ? [buyer] : [buyer, viewer]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 1440 ? 900 : width === 390 ? 844 : 720 },
        isMobile: width < 1000, deviceScaleFactor: width < 1000 ? 2 : 1,
        locale: "it-IT", reducedMotion: "reduce"
      });
      try {
        const page = await context.newPage();
        await login(page, p);
        await viewportCheck(page, { width, height: width === 1440 ? 900 : 844, role: p.id });
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
          assert.equal(await page.getByRole("button", { name: "Analizza la richiesta con AI" }).count(), 1);
          await page.screenshot({ path: path.join(screenshotsDir, `commercial-ai-to-private-distinta-${width}px.png`), fullPage: false, animations: "disabled" });
          console.log("COMM-TRUST1.D CHAT → PRIVATE DISTINTA PASS", width, "one-shot text, preview, no automatic analysis or dispatch");

          if (width === 1440) {
            // Explicitly exercise the manual alternative, not merely its href.
            await page.goto(base + "/commercial", { waitUntil: "domcontentloaded", timeout: 90000 });
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
          await page.screenshot({ path: path.join(screenshotsDir, "commercial-filtered-empty-1440px.png"), fullPage: false, animations: "disabled" });
          console.log("COMM-TRUST1.C FILTERED EMPTY PASS");

        }
        if (p.id === "buyerViewer" && width === 390) {
          // Search is an existing-record retrieval route and remains read-only.
          await page.getByTestId("commercial-history-entry").click();
          await page.waitForURL(u => u.pathname === "/commercial/search", { timeout: 90000 });
          assert.equal(new URL(page.url()).searchParams.get("compose"), null);
          console.log("COMM-TRUST1.D HISTORY RETRIEVAL PASS");
        }
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
console.log("COMM-UX6.A AUTHENTICATED VISUAL ACCEPTANCE PASS");
