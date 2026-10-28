import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const companion = readFileSync(new URL("../components/commercial-ai-companion.tsx", import.meta.url), "utf8");

test("Commerciale offers one role-gated AI entry before daily actions, with one RFQ builder", () => {
  assert.match(page, /<CommercialAiCompanion canWrite=\{canWrite\}/);
  assert.match(companion, /data-testid="commercial-ai-first"/);
  assert.match(companion, /data-testid="commercial-ai-first-cta"/);
  assert.match(companion, /onSubmit=\{startRequest\}/);
  assert.match(companion, /\?compose=1#commercial-ai-intake/);
  assert.ok(page.indexOf("<CommercialAiCompanion") < page.indexOf('data-testid="commercial-compact-actions"'));
  assert.match(companion, /\{canWrite \? \(/);
  assert.equal((page.match(/<BuyerDistintaBuilder/g) || []).length, 1);
});
