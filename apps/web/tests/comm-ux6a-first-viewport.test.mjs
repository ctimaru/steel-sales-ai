import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../app/(italian)/(workspace)/commercial/page.tsx");
const ai = read("../components/commercial-ai-companion.tsx");
const calculator = read("../components/commercial-calculator-quick-access.tsx");
const css = read("../components/commercial-cinematic.module.css");

test("COMM-UX6.A keeps one compact industrial hero and no duplicate jump navigation", () => {
  assert.match(page, /lg:min-h-\[172px\]/);
  assert.doesNotMatch(page, /sm:min-h-\[290px\]|lg:min-h-\[328px\]/);
  assert.match(css, /home-cine2a2b-factory-desktop\.webp/);
  assert.match(css, /home-cine2a2b-factory-mobile\.webp/);
  assert.match(page, /mode === "live" \? "Dati live"/);
  assert.match(page, /operational\.rfqs/);
  assert.match(page, /operational\.offers/);
  assert.match(page, /operational\.orders/);
  assert.doesNotMatch(page, /data-testid="commercial-cockpit-tabs"/);
  assert.doesNotMatch(page, />Vai a</);
});

test("COMM-UX6.A exposes calculator, private Distinte, new request before the actual worklist", () => {
  const steps = [
    "comm-cine1-hero",
    "comm-cine13-first-workspace",
    "commercial-primary-quick-actions",
    "<CommercialDirectorPriorityDesk",
    "<CommercialUnifiedWorklist",
  ];
  const positions = steps.map((key) => page.indexOf(key));
  assert.ok(positions.every((p) => p >= 0));
  assert.ok(positions.every((p, i) => i === 0 || p > positions[i - 1]));
  assert.equal((page.match(/<CommercialCalculatorQuickAccess/g) ?? []).length, 1);
  assert.equal((page.match(/<CommercialAiCompanion/g) ?? []).length, 1);
  assert.equal((page.match(/<CommercialUnifiedWorklist/g) ?? []).length, 1);
  assert.match(page, /\{canWrite \? \([\s\S]*?\+ Nuova richiesta/);
  assert.match(calculator, /appRoutes\.rfqHub\.savedDistinte/);
  assert.match(calculator, /<CalculatorRegionSwitch locale="it" initialRegion="eu"/);
});

test("COMM-UX6.A retains human-approved AI handoff and readonly access rules", () => {
  assert.match(ai, /onSubmit=\{startRequest\}/);
  assert.match(ai, /sessionStorage\.setItem\("sss:commercial-ai-intake-handoff", value\)/);
  assert.match(ai, /\?compose=1#commercial-ai-intake/);
  assert.match(ai, /disabled=\{!request\.trim\(\)\}/);
  assert.match(ai, /\{canWrite \? \(/);
  assert.match(ai, /nessuna richiesta viene inviata automaticamente/);
  assert.match(page, /canWriteWorkspace\(context\.role\)/);
  assert.match(page, /<BuyerDistintaBuilder/);
  assert.match(page, /non condividono automaticamente prezzi, contatti o documenti/);
});
