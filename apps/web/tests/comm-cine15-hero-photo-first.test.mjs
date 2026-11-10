import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../components/commercial-cinematic.module.css", import.meta.url), "utf8");
const ai = readFileSync(new URL("../components/commercial-ai-companion.tsx", import.meta.url), "utf8");

test("COMM-CINE15 foregrounds the existing industrial photo instead of masking it with a dashboard panel", () => {
  // COMM-DECLUTTER1: la testata è stata tolta dalla pagina; il pannello KPI non deve tornare.
  assert.doesNotMatch(page, /cinematic\.heroMetrics/);
  assert.doesNotMatch(page, /cinematic\.heroPanel/);
  assert.match(css, /\.hero::before/);
  assert.match(css, /home-cine2a2b-factory-desktop\.webp/);
  assert.match(css, /home-cine2a2b-factory-mobile\.webp/);
  assert.match(css, /\.heroGrid \{ grid-template-columns:/);
  assert.doesNotMatch(css, /\.heroPanel/);
});

test("COMM-CINE15 retains grounded KPIs with semantic labels and distinct demo/live status", () => {
  // I totali storici restano nei dati della pagina (sezione storico), non nella testata.
  assert.match(page, /label: "Richieste nello storico", value: historicalCount\(operational\.rfqs\)/);
  assert.match(page, /mode === "awaiting_assignment" \? "—" : count/);
  assert.match(page, /<CommercialAiCompanion canWrite=\{canWrite\}/);
  assert.match(ai, /onSubmit=\{startRequest\}/);
  assert.equal((page.match(/<CommercialUnifiedWorklist/g) || []).length, 1);
});
