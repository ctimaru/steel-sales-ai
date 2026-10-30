import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const companion = readFileSync(new URL("../components/commercial-ai-companion.tsx", import.meta.url), "utf8");

test("COMM-CINE1 unifies commercial visual hierarchy without losing essential workflows", () => {
  assert.match(source, /data-testid="comm-cine1-hero"/);
  assert.match(source, /Le tue trattative\./);
  assert.match(source, /Un’unica visione\./);
  assert.match(source, /Il tuo centro operativo/);
  assert.match(source, /operational\.rfqs/);
  assert.match(source, /operational\.offers/);
  assert.match(source, /operational\.orders/);
  assert.match(source, /bg-\[#082f28\]/);
  assert.match(source, /max-w-\[1480px\]/);
  assert.match(source, /\?compose=1#commercial-ai-intake/);
  assert.match(source, /<CommercialAiCompanion canWrite=\{canWrite\}/);
  assert.match(companion, /data-testid="commercial-ai-first"/);
  assert.match(source, /<CommercialCalculatorQuickAccess/);
  assert.match(source, /<CommercialUnifiedWorklist/);
  assert.match(source, /data-testid="commercial-primary-quick-actions"/);
});
