import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/(italian)/(workspace)/commercial/page.tsx");
const companion = read("../components/commercial-ai-companion.tsx");
const builder = read("../components/buyer-distinta-builder.tsx");
const workspace = read("../components/commercial-rfq-workspace.tsx");
const worklist = read("../components/commercial-unified-worklist.tsx");
const css = read("../components/commercial-cinematic.module.css");

test("COMM-TRUST1.D has exactly one primary chat entry into the canonical Distinta builder", () => {
  assert.equal((page.match(/<CommercialAiCompanion/g) ?? []).length, 1);
  assert.equal((page.match(/<BuyerDistintaBuilder/g) ?? []).length, 1);
  assert.match(companion, /Descrivi i tubi che ti servono/);
  assert.match(companion, /Apri chat e anteprima/);
  assert.match(companion, /data-testid="commercial-ai-first-cta"/);
  assert.match(companion, /sessionStorage\.setItem\("sss:commercial-ai-intake-handoff", value\)/);
  assert.match(companion, /\?compose=1&method=ai#commercial-ai-intake/);
  assert.match(page, /focusAiIntake=\{aiFocused\}/);
  assert.match(builder, /<CommercialRfqWorkspace/);
  assert.match(workspace, /data-testid="commercial-rfq-chat-workspace"/);
  assert.doesNotMatch(companion, /analyzeRfqAiFreeText|saveBuyerDistinta\(|sendBuyerDistinta\(|sendEmail\(/);
  assert.ok(page.indexOf("<CommercialDirectorPriorityDesk") < page.indexOf("<CommercialAiCompanion"));
  assert.ok(page.indexOf("<CommercialAiCompanion") < page.indexOf('data-testid="commercial-primary-quick-actions"'));
});

test("COMM-TRUST1.D exposes manual and calculator only as alternatives", () => {
  assert.equal((page.match(/<CommercialCalculatorQuickAccess/g) ?? []).length, 1);
  assert.match(page, /data-testid="commercial-alternative-methods"/);
  assert.match(page, /data-testid="commercial-manual-entry"/);
  assert.match(page, /\?compose=1#commercial-compose/);
  assert.match(page, /Compila manualmente/);
  assert.doesNotMatch(page + companion, /\+ Nuova richiesta/);
  assert.doesNotMatch(companion, /Compila manualmente/);
  assert.match(css, /data-commercial-alternative-methods/);
  assert.match(page, /<CommercialDirectorPriorityDesk/);
});

test("COMM-TRUST1.D historical search never starts a new RFQ", () => {
  assert.match(page, /data-testid="commercial-history-entry"/);
  assert.match(page, /href=\{appRoutes\.commercial\.search\} data-testid="commercial-history-entry"/);
  assert.match(page, /Cerca nello storico/);
  assert.match(page, /Ricerca su dati già presenti/);
  assert.match(page, /action=\{appRoutes\.commercial\.search\}/);
  assert.doesNotMatch(companion, /role="search"/);
  assert.match(worklist, /label: "Prepara con la chat"/);
  assert.match(worklist, /\?compose=1&method=ai#commercial-ai-intake/);
});

test("COMM-TRUST1.D keyboard and access policies remain explicit", () => {
  assert.match(companion, /event\.key === "Enter" && !event\.shiftKey && !event\.nativeEvent\.isComposing/);
  assert.match(companion, /event\.currentTarget\.form\?\.requestSubmit\(\)/);
  assert.match(companion, /disabled=\{!ready \|\| !request\.trim\(\)\}/);
  assert.match(companion, /if \(!canWrite \|\| !ready \|\| !value\) return/);
  assert.match(companion, /nessuna richiesta viene inviata automaticamente/i);
  assert.match(page, /canWriteWorkspace\(context\.role\)/);
  assert.match(companion, /\{canWrite \? \(/);
});
