import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../lib/commercial-ai-native-intent.ts");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { routeCommercialAiIntent: route } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const action = read("../app/(italian)/(workspace)/commercial/ai-native-actions.ts");
const shell = read("../components/commercial-ai-native-shell.tsx");

test("COMM-AI-NATIVE1.C distinguishes supplier research from Distinta extraction", () => {
  for (const input of ["Chi produce tubo S355 Ø608?", "Trova fornitori EN 10219 per Ø608x10", "Cerca carpenterie in Italia", "Who makes Ø608 structural tubes?"]) {
    assert.equal(route(input).intent, "industry_search", input);
  }
  assert.deepEqual(route("Chi produce tubo S355 Ø608?").missing, ["norma", "spessore"]);
  assert.equal(route("Chi produce tubo S355 Ø608x10 EN 10219").entities.thicknessMm, 10);
  assert.equal(route("Chi produce tubo S355 Ø608x10 EN 10219").entities.standard, "EN 10219");
  assert.equal(route("Chi produce tubo S355 Ø608x10 EN 10219").entities.grade, "S355");
  assert.deepEqual(route("Cerca carpenterie in Romania").missing, []);
});

test("COMM-AI-NATIVE1.C routes informative questions, edits, RFQ and unknown independently", () => {
  assert.equal(route("Qual è la differenza tra EN 10219 ed EN 10210?").intent, "technical_question");
  assert.equal(route("Preparami 24 barre Ø608×10 EN 10219").intent, "distinta_edit");
  assert.equal(route("Correggi la riga 2").intent, "distinta_edit");
  assert.equal(route("Trova fornitori e prepara la RFQ").intent, "rfq_prepare");
  assert.equal(route("Invia la RFQ ai fornitori").intent, "rfq_prepare");
  assert.equal(route("Buongiorno").intent, "unknown");
});

test("COMM-AI-NATIVE1.C model is server-only, read-only and auth-guarded", () => {
  assert.match(action, /"use server"/);
  assert.match(action, /getWorkspaceContext\(\)/);
  assert.match(action, /AI_GATEWAY_API_KEY/);
  assert.match(action, /commercialAiNativeResponse/);
  assert.doesNotMatch(action, /service_role|createBuyerRfqCampaign|sendBuyerDistinta|dispatchRfq|\.insert\(|\.update\(|\.from\([^)]*\)\.delete\(/);
  assert.match(shell, /commercialAiNativeResponse\(/);
  assert.match(shell, /startDistinta\(turn\.question\)/);
  assert.match(shell, /data-testid="commercial-ai-native-thread"/);
});
