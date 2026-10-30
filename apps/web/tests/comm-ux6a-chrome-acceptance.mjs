/**
 * COMM-UX6.A — synthetic Chrome acceptance for the first viewport and the
 * explicit AI → private Distinta text handoff. Uses only FLOW1 disposable
 * local Supabase users and Next.js. Never operates on production or Vercel.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

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
  await page.getByRole("heading", { name: "Oggi in " + p.name, exact: true })
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
  assert.ok(h.y < c.y && c.y < t.y && t.y < a.y && a.y < w.y, "Correct work-first reading order");
  assert.ok(await page.getByRole("button", { name: "Calcolatrice pesi" }).isVisible());
  // COMM-NAV9: a decision-first summary must remain compact, honest about
  // missing RFQ data and read-only for viewer roles.
  const priorities = page.getByTestId("commercial-director-rfq-priorities");
  const resume = page.getByTestId("commercial-director-resume");
  assert.equal(await priorities.count(), 1);
  assert.equal(await resume.count(), 1);
  assert.equal(await attention.getByRole("heading", { name: "Cosa richiede attenzione" }).count(), 1);
  assert.equal(await attention.getByRole("link", { name: "Apri inbox →" }).count(), 1);
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
  assert.equal(await companion.getByTestId("comm-cine11-prompt").count(), canWrite ? 1 : 0);
  const createRequest = page.getByRole("link", { name: "+ Nuova richiesta" });
  assert.equal(await createRequest.count(), canWrite ? 1 : 0);
  if (canWrite) {
    const fg = await createRequest.evaluate(el => ({
      color: getComputedStyle(el).color,
      textFill: getComputedStyle(el).webkitTextFillColor,
      background: getComputedStyle(el).backgroundColor,
    }));
    assert.equal(fg.color, "rgb(255, 255, 255)", "New request link must use readable white text");
    assert.equal(fg.textFill, "rgb(255, 255, 255)", "New request Safari/WebKit fill must be white");
    assert.notEqual(fg.background, "rgba(0, 0, 0, 0)", "New request CTA must have a solid background");
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
        if (width === 1440 && p.id === "buyer") {
          const sample = "40 tubi quadri 100×100×5 S355J2H EN 10219, 6 m";
          const input = page.locator("#commercial-ai-companion-input");
          await input.fill(sample);
          await page.getByTestId("commercial-ai-first-cta").click();
          await page.waitForURL(u => u.pathname === "/commercial" && u.searchParams.get("compose") === "1", { timeout: 90000 });
          const draft = page.locator("#rfqai2-text-input");
          await draft.waitFor({ state: "visible", timeout: 60000 });
          await page.waitForFunction(expected => document.querySelector("#rfqai2-text-input")?.value === expected, sample);
          assert.equal(await draft.inputValue(), sample);
          assert.equal(await page.evaluate(() => sessionStorage.getItem("sss:commercial-ai-intake-handoff")), null);
          assert.equal(await page.getByRole("button", { name: "Analizza la richiesta con AI" }).count(), 1);
          await page.screenshot({ path: path.join(screenshotsDir, "commercial-ai-to-private-distinta-1440px.png"), fullPage: false, animations: "disabled" });
          console.log("COMM-UX6.A AI → PRIVATE DISTINTA PASS: text handed off once, no automatic analysis or dispatch");
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
