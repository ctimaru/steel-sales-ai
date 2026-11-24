// Isolated component visual acceptance: no server, credentials, tenant or hosted data.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  if (cache.has(relative)) return cache.get(relative).exports;
  const file = path.join(root, relative);
  const module = { exports: {} };
  cache.set(relative, module);
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const localRequire = (name) => {
    if (name === "@/lib/mkt9-investor-deck-candidate") return load("lib/mkt9-investor-deck-candidate.ts");
    assert.ok(!name.startsWith("@/"), "Unexpected application dependency: " + name);
    return require(name);
  };
  new Function("require", "module", "exports", output)(localRequire, module, module.exports);
  return module.exports;
}
const { Mkt9InvestorDeckCandidate } = load("components/mkt9-investor-deck-candidate.tsx");
const cssFile = path.join(root, "app/globals.css");
const css = (await postcss([tailwind({ base: root })]).process(fs.readFileSync(cssFile, "utf8"), { from: cssFile })).css;
assert.ok(css.includes("--brand-deep"));
assert.ok(css.includes("18.12%"), "Expected generated progress-bar utility");
const out = process.env.RUNNER_TEMP ? path.join(process.env.RUNNER_TEMP, "mkt9-visual") : path.join(root, ".next/mkt9-visual");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
let checked = 0;
try {
  for (const locale of ["it", "en"]) {
    const markup = renderToStaticMarkup(React.createElement(Mkt9InvestorDeckCandidate, { locale }));
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
      try {
        await context.route("**/*", route => route.abort());
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", e => errors.push(e.message));
        await page.setContent('<!doctype html><html lang="' + locale + '"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main style="max-width:1600px;margin:auto;padding:12px">' + markup + '</main></body></html>');
        await page.addStyleTag({ content: css });
        await page.evaluate(() => document.fonts.ready);
        const slides = page.locator("[data-slide]");
        assert.equal(await slides.count(), 14);
        const metrics = await slides.evaluateAll(items => items.map(el => {
          const r = el.getBoundingClientRect();
          const content = [...el.querySelectorAll("h2,h3,p,footer")].map(n => n.getBoundingClientRect());
          return { number: el.dataset.slide, width: r.width, overflow: el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2,
            clipped: content.some(c => c.right > r.right + 2 || c.bottom > r.bottom + 2 || c.left < r.left - 2 || c.top < r.top - 2) };
        }));
        assert.ok(metrics.every(m => !m.overflow && !m.clipped), JSON.stringify({ locale, width, metrics }));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), "Page horizontal overflow");
        const progress = page.getByRole("progressbar");
        assert.equal(await progress.getAttribute("aria-valuenow"), "2718");
        assert.deepEqual(errors, []);
        for (const n of [1, 3, 6, 7, 12, 14]) {
          await page.locator('[data-slide="' + n + '"]').screenshot({ path: path.join(out, locale + "-" + width + "-slide-" + n + ".png"), animations: "disabled" });
        }
        checked++;
      } finally { await context.close(); }
    }
  }
  console.log("MKT9 isolated component Chrome PASS: " + checked + " locale/viewport combinations, 84 slides, 36 screenshots. No authenticated route tested.");
} finally { await browser.close(); }
