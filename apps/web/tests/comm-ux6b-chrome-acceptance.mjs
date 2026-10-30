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
        const continueAction = detail.getByRole("link", { name: /Continua →|Apri dettaglio →/ });
        await continueAction.waitFor({ state: "visible" });
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
