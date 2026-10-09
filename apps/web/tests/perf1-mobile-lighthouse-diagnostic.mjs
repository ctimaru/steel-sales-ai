/**
 * Diagnostic-only Chrome/Lighthouse benchmark on public URLs.
 * No logins, credentials, API writes or application mutations.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const targets = [
  { name: "post_PERF1_production", url: "https://www.smartsteelsales.com/" },
  { name: "pre_PERF1_previous_deployment", url: "https://steel-sales-apdyyeqf3-ctimaru-5113.vercel.app/" },
];
const reports = [
  { name: "new_mobile", url: "https://pagespeed.web.dev/analysis/https-smartsteelsales-com/ynykl1zqcv?hl=it&form_factor=mobile" },
  { name: "previous_mobile", url: "https://pagespeed.web.dev/analysis/https-smartsteelsales-com/bv6ixjdup8?hl=it&form_factor=mobile" },
];
const dir = mkdtempSync(path.join(tmpdir(), "perf1-lh-"));
const browser = await chromium.launch({ headless: true, channel: "chrome" });

async function checkServerTarget(item) {
  try {
    const res = await fetch(item.url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(20000) });
    const body = await res.text();
    console.log("PERF1 HTTP", JSON.stringify({
      target: item.name, status: res.status,
      contentType: res.headers.get("content-type"),
      cache: res.headers.get("x-vercel-cache"),
      location: res.headers.get("location"),
      htmlBytes: Buffer.byteLength(body),
      nextMarkers: body.includes("__next"),
      platformOrProtected: /authentication required|vercel authentication|deployment protection/i.test(body.slice(0, 8000)),
    }));
    return res.status === 200 && /text\/html/i.test(res.headers.get("content-type") || "");
  } catch (e) {
    console.log("PERF1 HTTP UNAVAILABLE", item.name, String(e).slice(0, 300));
    return false;
  }
}

async function inspectPageSpeed(report) {
  const context = await browser.newContext({ locale: "it-IT" });
  const page = await context.newPage();
  try {
    const response = await page.goto(report.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    const visible = await page.locator("body").innerText({ timeout: 25000 });
    console.log("PERF1 PSI REPORT", report.name, JSON.stringify({
      status: response?.status(),
      title: await page.title(),
      textLength: visible.length,
      excerpt: visible.slice(0, 6500),
    }));
  } catch (e) {
    console.log("PERF1 PSI REPORT UNAVAILABLE", report.name, String(e).slice(0, 450));
  } finally {
    await context.close();
  }
}

function runLighthouse(item, iteration) {
  const outfile = path.join(dir, item.name + "-" + iteration + ".json");
  try {
    execFileSync("node", [
      "node_modules/lighthouse/cli/index.js",
      item.url,
      "--only-categories=performance",
      "--form-factor=mobile",
      "--throttling-method=simulate",
      "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
      "--output=json",
      "--output-path=" + outfile,
      "--quiet",
    ], { cwd: process.cwd(), timeout: 180000, stdio: ["ignore", "pipe", "pipe"] });
    const lhr = JSON.parse(readFileSync(outfile, "utf8"));
    const metric = (key) => lhr.audits[key]?.numericValue ?? null;
    const result = {
      label: item.name,
      iteration,
      finalUrl: lhr.finalDisplayedUrl ?? lhr.finalUrl,
      fetchTime: lhr.fetchTime,
      score: lhr.categories?.performance?.score == null ? null : Math.round(lhr.categories.performance.score * 100),
      fcpMs: metric("first-contentful-paint"),
      lcpMs: metric("largest-contentful-paint"),
      tbtMs: metric("total-blocking-time"),
      cls: metric("cumulative-layout-shift"),
      speedIndexMs: metric("speed-index"),
      serverResponseMs: metric("server-response-time"),
      totalByteWeight: metric("total-byte-weight"),
      diagnostics: ["render-blocking-resources", "unused-javascript", "mainthread-work-breakdown", "network-requests"]
        .map(key => ({ key, score: lhr.audits[key]?.score ?? null, potentialSavingsMs: lhr.audits[key]?.details?.overallSavingsMs ?? null }))
        .filter(x => x.score !== null),
      warnings: (lhr.runWarnings ?? []).slice(0, 4),
    };
    console.log("PERF1 LIGHTHOUSE RESULT", JSON.stringify(result));
    return result;
  } catch (e) {
    console.log("PERF1 LIGHTHOUSE FAILED", item.name, iteration, String(e.message).slice(0, 450),
      e.stderr?.toString().slice(-1000) ?? "");
    return null;
  }
}

try {
  const available = [];
  for (const target of targets) {
    if (await checkServerTarget(target)) available.push(target);
  }
  for (const report of reports) await inspectPageSpeed(report);
  const entries = [];
  for (const target of available) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const row = runLighthouse(target, attempt);
      if (row) entries.push(row);
    }
  }
  for (const target of targets) {
    const sample = entries.filter(x => x.label === target.name && x.score != null && x.lcpMs != null && x.tbtMs != null);
    if (sample.length) {
      console.log("PERF1 LIGHTHOUSE SUMMARY", JSON.stringify({
        target: target.name, runs: sample.length,
        averagePerformance: +(sample.reduce((a,b)=>a+b.score,0)/sample.length).toFixed(1),
        averageLcpMs: Math.round(sample.reduce((a,b)=>a+b.lcpMs,0)/sample.length),
        averageTbtMs: Math.round(sample.reduce((a,b)=>a+b.tbtMs,0)/sample.length),
        averageFcpMs: Math.round(sample.reduce((a,b)=>a+b.fcpMs,0)/sample.length),
        scores: sample.map(x=>x.score), lcpSamples: sample.map(x=>Math.round(x.lcpMs)),
      }));
    } else console.log("PERF1 LIGHTHOUSE UNAVAILABLE", target.name);
  }
  assert.ok(entries.some(x=>x.label === "post_PERF1_production" && x.score != null),
    "Current production Lighthouse benchmark did not produce valid results");
} finally {
  await browser.close();
}
