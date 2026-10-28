import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../components/commercial-cinematic.module.css", import.meta.url), "utf8");
const ai = readFileSync(new URL("../components/commercial-ai-companion.tsx", import.meta.url), "utf8");

test("COMM-CINE15 foregrounds the existing industrial photo instead of masking it with a dashboard panel", () => {
  assert.match(page, /cinematic\.heroMetrics/);
  assert.doesNotMatch(page, /cinematic\.heroPanel/);
  assert.match(css, /\.hero::before/);
  assert.match(css, /home-cine2a2b-factory-desktop\.webp/);
  assert.match(css, /home-cine2a2b-factory-mobile\.webp/);
  assert.match(css, /\.heroGrid \{ grid-template-columns:/);
  assert.doesNotMatch(css, /\.heroPanel/);
  assert.match(page, /<div aria-label="Il tuo centro operativo"/);
});

test("COMM-CINE15 retains grounded KPIs with semantic labels and distinct demo/live status", () => {
  for (const [label, value] of [
    ["Richieste", "rfqs"],
    ["Offerte", "offers"],
    ["Ordini", "orders"],
  ]) {
    assert.match(page, new RegExp('<dt[^>]+>' + label + '<\\/dt><dd[^>]+>\\{operational\\.' + value + '\\}<\\/dd>'));
  }
  assert.match(page, /mode === "live" \? "Dati live"/);
  assert.match(page, /mode === "demo" \? "Modalità demo"/);
  assert.match(page, /Dati in attesa di associazione/);
  assert.match(page, /<CommercialAiCompanion canWrite=\{canWrite\}/);
  assert.match(ai, /onSubmit=\{startRequest\}/);
  assert.equal((page.match(/<CommercialUnifiedWorklist/g) || []).length, 1);
});
