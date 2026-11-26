// MKT-VISION2 (founder approval, 26 nov 2026): stessa visione, nuova grafica.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../app/(italian)/(workspace)/marketplace/page.tsx");
const steps = read("../components/marketplace-vision-steps.tsx");
const css = read("../app/globals.css");

test("hero: titolo, invito all'azione in alto ed esempio dichiarato illustrativo", () => {
  assert.match(page, /className="mkt-blueprint overflow-hidden rounded-\[28px\] text-white"/);
  assert.ok(page.indexOf("Crea una distinta →") < page.indexOf('id="marketplace-journey"'), "CTA above the fold");
  assert.match(page, /Esempio illustrativo/);
  assert.match(page, /<div aria-hidden="true" className="overflow-hidden rounded-\[20px\] mkt-lift/);
  assert.doesNotMatch(page, /€\s?\d|\d+[.,]\d+\s?€|\/t\b/, "no prices in the illustrative example");
  assert.match(page, /Space_Grotesk\(\{ subsets: \["latin"\]/);
});

test("passi interattivi accessibili, senza handler globali", () => {
  assert.match(steps, /^"use client";/);
  assert.match(steps, /role="tablist"/);
  assert.match(steps, /role="tab"/);
  assert.match(steps, /role="tabpanel"/);
  assert.match(steps, /aria-selected=\{on\}/);
  assert.doesNotMatch(steps, /addEventListener|window\./);
  assert.match(page, /<MarketplaceVisionSteps steps=\{journey\} \/>/);
  assert.equal((page.match(/^    title: "(Chiedi|Trova|Pubblica o invia|Confronta|Ordina)",$/gm) ?? []).length, 5);
});

test("stessi testi e regole della visione, nessun dato operativo", () => {
  for (const text of ["Per chi compra", "Per chi vende", "Fiducia prima di tutto", "Come ci arriviamo", "Il primo tassello è già qui"]) {
    assert.ok(page.includes(text), text);
  }
  assert.doesNotMatch(page, /supabase|getMarketplace|createClient/);
  assert.match(css, /\.mkt-display \{/);
  assert.match(css, /\.mkt-lift \{/);
  assert.doesNotMatch(page, /shadow-\[0_/, "the shell strips shadow-[0_…]: use mkt-lift");
});
