import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/commercial-ai-companion.tsx", import.meta.url), "utf8");

test("COMM-CINE10 provides a single integrated AI companion", () => {
  assert.match(page, /<CommercialAiCompanion canWrite=\{canWrite\}/);
  assert.equal((page.match(/commercial-ai-first-heading/g) ?? []).length, 0);
  assert.match(component, /Ciao, cosa stai cercando oggi\?/);
  assert.match(component, /data-testid="commercial-ai-first"/);
  assert.match(component, /data-testid="commercial-ai-first-cta"/);
});
test("COMM-CINE10 offers only real user-triggered commercial entry points", () => {
  assert.match(component, /sss:open-commercial-calculator/);
  assert.match(component, /appRoutes\.commercial\.assistant/);
  assert.match(component, /appRoutes\.commercial\.home/);
  assert.match(component, /canWrite \? \(/);
  assert.match(component, /comm-cine11-prompt/);
  assert.match(component, /sss:commercial-ai-intake-handoff/);
  assert.match(component, /nessuna richiesta viene inviata automaticamente/i);
});
