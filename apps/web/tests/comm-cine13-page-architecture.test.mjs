import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const list = readFileSync(new URL("../components/commercial-unified-worklist.tsx", import.meta.url), "utf8");
const priorities = readFileSync(new URL("../components/commercial-director-priority-desk.tsx", import.meta.url), "utf8");

test("COMM-NAV9.M places director decisions before AI and tools, then deals, without duplicate editors", () => {
  const positions = [
    'data-testid="comm-cine1-hero"',
    "<CommercialDirectorPriorityDesk",
    'data-testid="comm-cine13-first-workspace"',
    'data-testid="commercial-primary-quick-actions"',
    "<CommercialUnifiedWorklist",
    'id="commercial-memory-panel"',
    'id="commercial-tools-panel"',
  ].map((needle) => page.indexOf(needle));
  assert.ok(positions.every((i) => i >= 0), "all primary and secondary sections exist");
  assert.ok(positions.every((pos, i) => i === 0 || positions[i - 1] < pos), "sections follow work-first order");
  assert.equal(page.split("<CommercialAiCompanion").length - 1, 1);
  assert.equal(page.split("<CommercialUnifiedWorklist").length - 1, 1);
  assert.equal(page.split("<CommercialCalculatorQuickAccess").length - 1, 1);
});

test("COMM-CINE13 removes duplicate status and filters while keeping real operational paths", () => {
  assert.match(page, /<CommercialDirectorPriorityDesk/);
  assert.match(priorities, /id="commercial-today" aria-labelledby="commercial-today-heading"/);
  assert.doesNotMatch(page, /data-testid="commercial-cockpit-tabs"/);
  assert.doesNotMatch(page, /Che cosa vuoi fare oggi\?/);
  assert.doesNotMatch(page, /Vista rapida delle trattative/);
  assert.match(list, /aria-label="Filtra attività commerciali"/);
  assert.match(list, /<SelectedDetail item=\{active\}/);
  assert.match(page, /<BuyerDistintaBuilder/);
  assert.match(page, /\(networkContext \|\| showProspects\)/);
  assert.match(page, /non condividono automaticamente prezzi, contatti o documenti/);
});
