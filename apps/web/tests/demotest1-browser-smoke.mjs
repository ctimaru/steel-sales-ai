/**
 * Read-only Chromium smoke: no account creation, login, dispatch or writes.
 * Run with: DEMOTEST_BASE_URL=https://www.smartsteelsales.com node tests/demotest1-browser-smoke.mjs
 * Requires Playwright installed in the runner.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.DEMOTEST_BASE_URL || "https://www.smartsteelsales.com").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });

try {
  for (const path of ["/", "/login", "/register"]) {
    const response = await page.goto(baseUrl + path, { waitUntil: "domcontentloaded", timeout: 45000 });
    assert.ok(response && response.status() < 500, path + " returned a server error");
    const text = await page.locator("body").innerText();
    assert.ok(text.trim().length > 30, path + " rendered no content");
    console.log("CHROMIUM PASS", path, response.status());
  }

  const privateResponse = await page.goto(baseUrl + "/platform/marketing/demo-room/companies", {
    waitUntil: "domcontentloaded", timeout: 45000,
  });
  assert.ok(privateResponse && privateResponse.status() < 500, "owner-only route server error");
  const privateBody = await page.locator("body").innerText();
  assert.ok(!privateBody.includes("DEMO Industrial Engineering"), "NO_PRIVATE_LEAK: demo-company data exposed to anonymous visitor");
  assert.ok(!privateBody.includes("Quattro aziende demo · quattro ruoli Network"), "NO_PRIVATE_LEAK: private fixture rendered anonymously");
  console.log("CHROMIUM PASS", "NO_PRIVATE_LEAK", privateResponse.status());

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileResponse = await page.goto(baseUrl + "/register", { waitUntil: "domcontentloaded", timeout: 45000 });
  assert.ok(mobileResponse && mobileResponse.status() < 500, "mobile registration route failed");
  assert.ok((await page.locator("body").innerText()).length > 30);
  console.log("CHROMIUM PASS", "mobile /register");
} finally {
  await browser.close();
}
