import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const commercial = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const schoolNav = readFileSync(new URL("../components/school-unified-navigation.tsx", import.meta.url), "utf8");
const ai = readFileSync(new URL("../components/commercial-ai-companion.tsx", import.meta.url), "utf8");
const schoolReading = readFileSync(new URL("../components/school-reading-index.tsx", import.meta.url), "utf8");

test("COMM-CINE18 preserves distinct School and private Commerciale experiences after integration", () => {
  assert.match(schoolNav, /localizedKnowledgePath/);
  assert.match(schoolReading, /export function SchoolReadingIndex/);
  assert.match(schoolReading, /keyboard-accessible reading navigation/);
  assert.match(schoolNav, /calculatorFromSchool/);
  assert.match(schoolNav, /surface=school_nav/);
  assert.match(commercial, /data-testid="comm-cine1-hero"/);
  assert.match(commercial, /data-testid="comm-cine13-first-workspace"/);
  assert.match(commercial, /<CommercialAiCompanion canWrite=\{canWrite\}/);
  assert.match(commercial, /<CommercialUnifiedWorklist/);
  assert.equal((commercial.match(/<CommercialAiCompanion/g) ?? []).length, 1);
  assert.equal((commercial.match(/<CommercialUnifiedWorklist/g) ?? []).length, 1);
  assert.match(ai, /nessuna richiesta viene inviata automaticamente/);
});
