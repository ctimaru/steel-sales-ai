import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const companion = readFileSync(new URL("../components/commercial-ai-companion.tsx", import.meta.url), "utf8");

test("COMM-CINE1 unifies commercial visual hierarchy without losing essential workflows", () => {
  assert.match(source, /data-testid="comm-cine1-hero"/);
  // COMM-DECLUTTER1: la testata scenografica è stata tolta; resta il titolo per gli screen reader.
  assert.match(source, /<h1 className="sr-only" data-testid="comm-cine1-hero">Commerciale · Le tue trattative<\/h1>/);
  assert.doesNotMatch(source, /Un’unica visione\./);
  assert.match(source, /max-w-\[1480px\]/);
  assert.match(source, /\?compose=1&method=ai#commercial-ai-intake/);
  assert.match(source, /<CommercialAiCompanion canWrite=\{canWrite\}/);
  assert.match(companion, /data-testid="commercial-ai-first"/);
  assert.match(source, /<CommercialCalculatorQuickAccess/);
  assert.match(source, /<CommercialUnifiedWorklist/);
  assert.match(source, /data-testid="commercial-primary-quick-actions"/);
});
