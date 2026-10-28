import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const calc = source("../components/public-tube-weight-calculator.tsx");
const englishSmoke = source("./i18n4-production-seo-chrome.mjs");
const httpSmoke = source("./demotest24-production-http.mjs");
const chromeSmoke = source("./demotest24-production-chrome.mjs");
const rfqChrome = source("./rfqh14-2-chrome-procurement.mjs");

test("PROD-NEXT1.B English calculator tests the current native norm selector and both EN modes", () => {
  assert.match(calc, /<select aria-label=\{t\("Norma"\)\} value=\{standard\}/);
  assert.match(calc, /value: "en10219"/);
  assert.match(calc, /value: "en10210"/);
  assert.match(englishSmoke, /getByRole\("combobox", \{ name: "Standard", exact: true \}\)/);
  assert.match(englishSmoke, /selectOption\("en10210"\)/);
  assert.match(englishSmoke, /selectOption\("en10219"\)/);
  assert.doesNotMatch(englishSmoke, /getByRole\("button", \{name:"EN 10219"\}\)/);
  assert.match(englishSmoke, /button\.tube-calculator-copy-action/);
  assert.match(englishSmoke, /xpath=ancestor::details\[1\]/);
  assert.match(englishSmoke, /copyAction\.waitFor\(\{ state: "visible"/);
});

test("PROD-NEXT1.A treats Commerciale as private in the public sitemap and anonymous HTTP/Chrome", () => {
  assert.match(httpSmoke, /const BASE = "https:\/\/www\.smartsteelsales\.com"/);
  assert.match(httpSmoke, /method: "GET"/);
  assert.match(httpSmoke, /"\/commercial"/);
  assert.match(httpSmoke, /privatePath of/);
  assert.match(httpSmoke, /isLoginRedirect \|\| isLoginForm/);
  assert.match(chromeSmoke, /"\/commercial"/);
  assert.match(chromeSmoke, /\["GET","HEAD"\]/);
  assert.match(chromeSmoke, /await route\.abort\(\)/);
  assert.match(chromeSmoke, /waitForURL\(u => u\.pathname === "\/login"/);
});

test("PROD-NEXT1.C synthetic RFQ gate checks quote prices and never uses production credentials", () => {
  assert.match(rfqChrome, /data-supplier-response-ready/);
  assert.match(rfqChrome, /First quoted price must survive draft save/);
  assert.match(rfqChrome, /Second quoted price must survive draft save/);
  assert.match(rfqChrome, /Offerta inviata\|submitted/);
  assert.match(rfqChrome, /127\.0\.0\.1:3000/);
  assert.doesNotMatch(rfqChrome, /smartsteelsales\.com\/rfq\/respond/);
});
