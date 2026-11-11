import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/(italian)/(workspace)/commercial/page.tsx");
const shell = read("../components/commercial-ai-native-shell.tsx");
const source = read("../lib/commercial-ai-native-ui.ts");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { classifyCommercialAiNativeTopic: classify } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

test("COMM-AI-NATIVE1.B treats company requests as read-only, never as RFQ extraction", () => {
  for (const value of [
    "Chi produce tubo S355 Ø608?",
    "Trova fornitori EN 10219 per 608 x 10",
    "Quali produttori di tubi strutturali ci sono in Romania?",
    "Cerca carpenterie in Italia",
  ]) assert.equal(classify(value), "network", value);
  assert.equal(classify("Preparami 24 barre Ø608×10 EN 10219"), "distinta");
  assert.equal(classify("Qual è la differenza EN 10219 e EN 10210?"), "knowledge");
  assert.equal(classify(""), "general");
});

test("COMM-AI-NATIVE1.B has a reversible UI-only entry and keeps all deep links", () => {
  assert.match(page, /params\.experience === "ai"/);
  assert.match(page, /COMM_AI_NATIVE_UI_ENABLED !== "0"/);
  assert.match(page, /params\.experience !== "classic"/);
  assert.match(page, /const legacyRouteRequested/);
  assert.match(page, /<CommercialAiNativeShell canWrite=\{canWrite\}/);
  assert.match(page, /<BuyerDistintaBuilder/);
  assert.match(page, /<CommercialUnifiedWorklist/);
  assert.match(shell, /\?experience=classic/);
  assert.match(shell, /appRoutes\.rfqHub\.home/);
  assert.match(shell, /commercial-ai-native-new-chat/);
  assert.match(shell, /Strumenti/);
  assert.doesNotMatch(shell, /lg:grid-cols-\[minmax/);
});

test("COMM-AI-NATIVE1.B/C keeps honest evidence labels and the authorized Distinta path", () => {
  assert.match(shell, /cronologia solo in questa scheda, nessuna memoria persistente/);
  assert.match(shell, /commercialAiNativeResponse/);
  assert.match(shell, /sss:commercial-ai-intake-handoff/);
  assert.match(shell, /\?compose=1&method=ai#commercial-ai-intake/);
  assert.match(shell, /onClick=\{\(\) => startDistinta\(turn\.question\)\}/);
  assert.match(shell, /if \(!canWrite \|\| !ready/);
  assert.match(shell, /data-testid="commercial-ai-native-mobile-drawer"/);
  assert.match(shell, /\.showModal\(\)/);
  assert.match(shell, /\.close\(\)/);
  assert.doesNotMatch(shell, /fetch\(|createBuyerRfqCampaign|sendBuyerDistinta|service_role|autoDispatch|localStorage/);
});
