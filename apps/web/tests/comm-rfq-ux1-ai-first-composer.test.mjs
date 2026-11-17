import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = name => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const page = read("../app/(italian)/(workspace)/commercial/page.tsx");
const companion = read("../components/commercial-ai-companion.tsx");
const builder = read("../components/buyer-distinta-builder.tsx");
const intake = read("../components/rfq-ai-intake-ux.tsx");
const handoff = read("../lib/commercial-ai-intake-handoff.ts");

test("COMM-RFQ-UX1 retains the private one-shot text transfer with explicit AI consent", () => {
  assert.match(companion, /sessionStorage\.setItem\("sss:commercial-ai-intake-handoff", value\)/);
  assert.match(companion, /newRequestHref\(\)/);
  assert.match(page, /const aiFocused = composing && params\.method === "ai"/);
  assert.match(handoff, /sessionStorage\.removeItem\(HANDOFF_KEY\)/);
  assert.match(intake, /consumeCommercialAiTextHandoff\(MAX_TEXT_CHARS\)/);
  assert.match(intake, /onClick=\{analyzeText\}/);
  assert.match(intake, /analyzeRfqAiFreeText\(submitted\)/);
  assert.match(intake, /Il testo viene inviato al servizio AI solo quando premi Analizza/);
});

test("COMM-RFQ-UX1 / DISTINTA-ONE1 the focused workflow is the single «Nuova richiesta» screen", () => {
  const single = read("../app/(italian)/(workspace)/rfq-hub/distinta/page.tsx");
  assert.match(single, /data-testid="new-request-steps"/);
  assert.match(single, /Nuova richiesta/);
  assert.match(single, /focusAiIntake\n/);
  assert.equal((page.match(/<BuyerDistintaBuilder/g) ?? []).length, 0);
  assert.match(page, /redirect\(legacyComposeRedirect\(params\)\)/);
});

test("COMM-RFQ-UX1 puts the text review before manual tools and hides the empty cart statistics", () => {
  assert.match(builder, /focusAiIntake = false/);
  assert.match(builder, /useState<RfqAiIntakeMode>\(focusAiIntake && workspace \? "text" : "manual"\)/);
  assert.match(builder, /\{focusAiIntake && !restoreCandidate \? \(/);
  assert.ok(builder.indexOf("<CommercialRfqWorkspace") < builder.indexOf("data-private-calculator-shell"));
  assert.match(builder, /\{!focusAiIntake \? \(/);
  assert.match(builder, /hidden=\{focusAiIntake && !showManualTools\}/);
  assert.doesNotMatch(builder, /data-testid="commercial-ai-manual-tools-toggle"/); // COMM-RFQ-CREATE2: niente calcolatrice qui
  assert.match(intake, /data-testid="commercial-ai-focused-modes"/);
  assert.match(intake, /aria-pressed=\{mode === "manual"\}/);
  assert.match(intake, /Preferisci configurare manualmente/);
  assert.match(intake, /rows=\{focused \? 3 : 7\}/);
  assert.match(builder, /scrollIntoView\(\{ block: "start", behavior: "auto" \}\)/);
});

test("COMM-RFQ-UX1 makes approved articles actionable while keeping private save and RFQ separate", () => {
  const preview = read("../components/commercial-rfq-live-preview.tsx");
  assert.match(builder, /<CommercialRfqLivePreview/);
  assert.match(preview, /data-testid="commercial-rfq-live-preview"/);
  assert.match(preview, /data-testid="commercial-rfq-approved-lines"/);
  assert.match(builder, /onClick=\{saveDistinta\}/);
  assert.match(builder, /onClick=\{createRfqHub\}/);
  assert.match(builder, /onOpenEditor=\{\(\) => \{ setShowManualTools\(true\); openPrivateCart\(\); \}\}/);
  assert.match(preview, /disabled=\{!canSave \|\| Boolean\(savedId\)\}/);
  assert.match(builder, /Explicit human-approved candidates from the review UI/);
  assert.match(builder, /crea la RFQ con un clic/);
  assert.match(preview, /non invia messaggi ai fornitori/);
});

test("COMM-RFQ-UX1 TSX changed modules parse without JSX syntax errors", () => {
  for (const [name, source] of [
    ["commercial/page.tsx", page],
    ["commercial-ai-companion.tsx", companion],
    ["buyer-distinta-builder.tsx", builder],
    ["rfq-ai-intake-ux.tsx", intake],
  ]) {
    const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")), [], name);
  }
});
