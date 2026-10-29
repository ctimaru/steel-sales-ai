/** SCHOOL-AI1 Chrome acceptance: screenshots and source-boundary behavior on localhost. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3000";
const path = "/knowledge/professore";
const out = "test-results/school-ai1";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const queries = [];
    await page.route("**/api/public/school-evidence?*", async route => {
      const url = new URL(route.request().url());
      queries.push(Object.fromEntries(url.searchParams));
      const expected = {
        schemaVersion: "school-evidence.v1",
        items: [{
          id: "standards:en-10219", code: "EN 10219", kind: "standards",
          title: "Fixture — published standard", summary: "Fixture summary from a published evidence card.",
          technicalContext: "Fixture technical context; not a normative statement.",
          caution: null, rfqGuidance: null,
          citations: [{url: "https://www.smartsteelsales.com/knowledge/norme/en-10219", label: "EN 10219", role: "public_page"}],
          provenance: {status: "k2_published", k2LastReviewedAt: "2026-10-04"},
        }],
      };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(expected) });
    });
    const res = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert.equal(res?.status(), 200, "public route " + width);
    assert.equal(await page.locator("h1").count(), 1, "one headline");
    await page.screenshot({ path: out + "/professor-" + width + "-initial.png", animations: "disabled" });
    await page.getByRole("button", { name: /Come si producono i tubi/ }).click();
    await page.getByRole("link", { name: /Apri la guida con fonti/ }).waitFor();
    assert.equal(queries.length, 0, "topic-only question must not contact source or model");
    await page.locator("#tutor-question").fill("Mi spieghi EN 10219?");
    await page.getByRole("button", { name: /Chiedi al professore/ }).click();
    await page.getByText("Fixture — published standard").waitFor();
    await page.getByText("In breve · Riferimento pubblicato").waitFor();
    assert.equal(await page.getByRole("link", {name: /Apri l'assistente aziendale/}).count(),0,"no competing tutor journey");
    const detail=page.getByText("Fixture technical context; not a normative statement.");
    assert.equal(await detail.isVisible(),false,"longer technical context starts collapsed");
    await page.getByText("Approfondisci il contesto tecnico").click();
    assert.equal(await detail.isVisible(),true,"learner can expand published technical context");
    await page.getByRole("button", {name: /Che cosa devo verificare/}).click();
    await page.getByText("La scheda non indica cautele specifiche.").waitFor();
    assert.equal(await detail.isVisible(),false,"switching follow-up hides previously selected context");
    assert.equal(queries.length, 1,"guided source-only follow-ups must never contact the endpoint again");
    assert.equal(queries[0].q, "en10219");
    assert.equal(queries[0].locale, "it");
    assert.equal(queries[0].limit, "2");
    assert.equal(await page.locator('a[href="https://www.smartsteelsales.com/knowledge/norme/en-10219"]').count(), 1);
    const sizes = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, full: document.documentElement.scrollWidth }));
    assert.ok(sizes.full <= sizes.vw + 12, "no horizontal overflow at " + width + ": " + JSON.stringify(sizes));
    await page.screenshot({ path: out + "/professor-" + width + "-source.png", animations: "disabled" });
    console.log("SCHOOL-AI1 CHROME PASS", width, queries);
    await context.close();
  }
} finally { await browser.close(); }
