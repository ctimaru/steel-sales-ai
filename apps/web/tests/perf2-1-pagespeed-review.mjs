import assert from "node:assert/strict";
import { chromium } from "playwright";

const reports = [
  ["before_PERF1", "https://pagespeed.web.dev/analysis/https-smartsteelsales-com/bv6ixjdup8?hl=it&form_factor=mobile"],
  ["after_PERF1", "https://pagespeed.web.dev/analysis/https-smartsteelsales-com/ynykl1zqcv?hl=it&form_factor=mobile"],
  ["after_PERF2_1", "https://pagespeed.web.dev/analysis/https-smartsteelsales-com/itxgr2ru3v?hl=it&form_factor=mobile"],
];
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const extracted = [];
try {
  for (const [name, url] of reports) {
    const context = await browser.newContext({ locale: "it-IT" });
    try {
      const page = await context.newPage();
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(5000);
      const body = await page.locator("body").innerText({ timeout: 20000 });
      const performance = body.match(/Diagnostica i problemi di prestazioni\s+(\d{1,3})\s+Prestazioni/);
      const labels = ["First Contentful Paint", "Largest Contentful Paint", "Total Blocking Time", "Cumulative Layout Shift", "Speed Index"];
      const metrics = Object.fromEntries(labels.map(label => {
        const start = body.indexOf(label);
        const segment = start < 0 ? "" : body.slice(start + label.length, start + label.length + 35);
        return [label, segment.match(/^\s*([0-9]+(?:[.,][0-9]+)?\s*(?:ms|s)?)/)?.[1] ?? "not available"];
      }));
      const output = {
        name,
        status: response?.status(),
        performance: performance ? Number(performance[1]) : null,
        metrics,
        reportDate: body.match(/Report di[^\n]*/)?.[0] ?? "",
        captured: body.match(/Captured at[^\n]*/)?.[0] ?? "",
        noRealData: body.includes("Nessun dato"),
        excerpt: body.slice(0, 2000),
      };
      extracted.push(output);
      console.log("PERF2.1 PAGESPEED ARCHIVED REPORT", JSON.stringify(output));
    } catch (error) {
      console.log("PERF2.1 PAGESPEED FETCH ERROR", name, String(error));
    } finally { await context.close(); }
  }
  assert.equal(extracted.length, 3);
  assert.ok(extracted.every(r => r.status === 200 && r.performance !== null));
  console.log("PERF2.1 PAGESPEED COMPARISON", JSON.stringify(extracted.map(r => ({
    name: r.name, performance: r.performance, metrics: r.metrics, captured: r.captured
  }))));
} finally { await browser.close(); }
