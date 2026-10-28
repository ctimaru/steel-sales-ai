import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const assistant = readFileSync(new URL("../components/commercial-ai-companion.tsx", import.meta.url), "utf8");
const intake = readFileSync(new URL("../components/rfq-ai-intake-ux.tsx", import.meta.url), "utf8");
const handoff = readFileSync(new URL("../lib/commercial-ai-intake-handoff.ts", import.meta.url), "utf8");

test("COMM-CINE11 transfers only explicitly submitted free text into the existing private RFQ review", () => {
  assert.match(assistant, /onSubmit=\{startRequest\}/);
  assert.match(assistant, /sessionStorage\.setItem\("sss:commercial-ai-intake-handoff", value\)/);
  assert.match(assistant, /\?compose=1#commercial-ai-intake/);
  assert.match(intake, /if \(!workspace \|\| mode !== "text"\) return/);
  assert.match(intake, /consumeCommercialAiTextHandoff\(MAX_TEXT_CHARS\)/);
  assert.match(handoff, /window\.sessionStorage\.removeItem\(HANDOFF_KEY\)/);
  assert.match(intake, /setTextDraft\(draft\)/);
  assert.match(handoff, /value\.slice\(0, maxChars\)/);
  assert.match(intake, /analyzeRfqAiFreeText\(textDraft\)/);
});

test("COMM-CINE12 keeps attention but removes the duplicate activity action bar", () => {
  assert.match(page, /data-testid="commercial-compact-attention"/);
  assert.match(page, /Attività da gestire oggi/);
  assert.doesNotMatch(page, /Che cosa vuoi fare oggi\?/);
  assert.match(page, /<CommercialAiCompanion canWrite=\{canWrite\}/);
  assert.match(page, /<CommercialUnifiedWorklist/);
});
