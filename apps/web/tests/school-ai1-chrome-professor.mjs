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
    const illustration = await page.request.get(base + "/school-professor-art1.svg");
    assert.equal(illustration.status(), 200, "premium illustration asset reachable at " + width);
    assert.match(illustration.headers()["content-type"] ?? "", /image\/svg\+xml/, "SVG served with image MIME type");
    assert.equal(await page.locator('svg image[href="/school-professor-art1.svg"]').count(), 2,
      "both responsive teacher instances share one original SVG asset");
    assert.equal(await page.locator("h1").first().textContent(), "Come posso aiutarti?");
    await page.screenshot({ path: out + "/professor-" + width + "-initial.png", animations: "disabled" });
    // SOURCE-BOUND CONTENT1.D: direct entry from a published comparison
    // populates only a whitelisted editorial guide, without contacting K2.
    const comparisonPage = await context.newPage();
    const comparisonCalls = [];
    await comparisonPage.route("**/api/public/school-evidence?*", async route => {
      comparisonCalls.push(route.request().url());
      await route.abort();
    });
    const editorial = await comparisonPage.goto(base + "/knowledge/professore?topic=en-10210-vs-en-10219", {
      waitUntil: "domcontentloaded", timeout: 60000,
    });
    assert.equal(editorial?.status(), 200, "public Professor source-bound entry");
    const comparison = comparisonPage.locator('[data-testid="school-content1d-comparison"]');
    await comparison.waitFor({ state: "visible" });
    assert.match(await comparison.textContent() ?? "", /EN 10210 ed EN 10219/);
    assert.equal(await comparisonPage.getByRole("heading", { name: "Confronto tecnico" }).count(), 1,
      "contextual deep-link keeps one distinct section label");
    const primaryLink = comparison.locator("a.school-primary-action");
    assert.equal(await primaryLink.count(), 1, "use approved accessible School CTA");
    assert.equal(await primaryLink.evaluate(node => getComputedStyle(node).color), "rgb(255, 255, 255)",
      "primary action must maintain white text on dark green");
    assert.match(await comparison.textContent() ?? "", /non garantisce uguali raggi/i);
    assert.ok(await comparison.locator('a[href*="store.uni.com"]').count() >= 2,
      "published official sources are visible");
    assert.equal(comparisonCalls.length, 0, "comparison direct entry needs no K2 request");
    await comparisonPage.screenshot({ path: out + "/professor-content1d-" + width + ".png",
      fullPage: true, animations: "disabled" });
    await comparisonPage.locator("#tutor-question").fill("Che documento EN 10204 devo richiedere?");
    await comparisonPage.getByRole("button", { name: /Chiedi al professore/ }).click();
    await comparisonPage.getByRole("heading", { name: /EN 10204: quali documenti/ }).waitFor();
    assert.equal(comparisonCalls.length, 0, "document guidance needs no private/public API calls");
    const dimension = await comparisonPage.evaluate(() => ({
      width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(dimension.scroll <= dimension.width + 12, "no source answer mobile overflow");
    await comparisonPage.close();
    const samples = page.locator('[data-testid="school-qa3-prompt-suggestions"]');
    assert.equal(await samples.getByRole("button").count(), 2, "two initial visible sample prompts at "+width);
    const moreQuestions = page.locator('[data-testid="school-qa3-more-questions"]');
    assert.equal(await moreQuestions.getAttribute("open"), null, "more questions start collapsed");
    if (width === 390) {
      const portrait = page.locator('[data-testid="school-qa3-mobile-portrait"]');
      assert.equal(await portrait.isVisible(), true, "teacher stays visible on mobile");
      const status = page.locator('[data-testid="school-tutor3-presence"]');
      assert.equal(await status.isVisible(), true, "teacher status text remains visible on mobile");
    }
    await moreQuestions.locator("summary").click();
    assert.equal(await moreQuestions.getAttribute("open"), "", "extra sample questions can be opened");
    await page.getByRole("button", { name: /Come si producono i tubi/ }).click();
    await page.getByRole("link", { name: /Apri la guida con fonti/ }).waitFor();
    assert.equal(queries.length, 0, "topic-only question must not contact source or model");
    await page.locator("#tutor-question").fill("Mi spieghi EN 10219?");
    await page.getByRole("button", { name: /Chiedi al professore/ }).click();
    await page.getByText("Fixture — published standard").waitFor();
    await page.getByText("In breve · Riferimento pubblicato").waitFor();
    const curatedPanel=page.locator('[data-testid="school-content1d-curated-k2"]');
    await curatedPanel.waitFor({state:"visible"});
    assert.match(await curatedPanel.textContent() ?? "", /EN 10219/i,
      "published K2 includes curated A/B original guidance");
    assert.ok(await curatedPanel.locator('a[href*="store.uni.com"]').count()>0,
      "curated published K2 guidance has its original UNI citations");
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
