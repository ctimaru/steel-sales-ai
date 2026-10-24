import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const calc = read("../components/public-tube-weight-calculator.tsx");
const builder = read("../components/buyer-distinta-builder.tsx");
const handoff = read("../lib/calculator-rfq-handoff.ts");
const dist = read("../lib/buyer-distinta.ts");

test("BD11: the existing calculator is the default entry with an adjacent live bill", () => {
  assert.match(builder, /<PublicTubeWeightCalculator\b[^>]*references=\{\[\]\}/);
  assert.match(builder, /<PublicTubeWeightCalculator\b[^>]*discoveryOptions=\{discoveredBuyerDimensions\}/);
  assert.match(builder, /<PublicTubeWeightCalculator\b[^>]*onAddToDistinta=\{addCalculatorLine\}/);
  assert.match(builder, /id="buyer-live-preview"/);
  assert.match(builder, /2 · \{t\("La tua distinta"\)\}/);
  assert.match(builder, /Altri metodi · testo AI/);
  assert.match(builder, /<RfqAiIntakeUx/);
  assert.match(builder, /<BuyerTubeGuidedCreator/);
});

test("BD11: in-place add skips the queue, persists as an editable line, and keeps older handoff", () => {
  assert.match(calc, /onAddToDistinta\?: \(item: CalculatorRfqItem\) => boolean/);
  assert.match(calc, /if \(onAddToDistinta\) \{[\s\S]*?onAddToDistinta\(item\)[\s\S]*?return;[\s\S]*?enqueueCalculatorRfq/);
  assert.match(builder, /calculatorItemToBuyerLine\(item, id\)/);
  assert.match(builder, /setLines\(\(current\) =>/);
  assert.match(builder, /setCopyState\("idle"\)/);
  assert.match(builder, /calculateBuyerDistintaLine\(nextLine\)\.complete/);
});

test("BD11: weight remains theoretical and per-line standard and grade are respected", () => {
  assert.match(handoff, /weightKgM:item\.kgM\.toLocaleString/);
  assert.match(dist, /\(meters \* weightKgM\) \/ 1000/);
  assert.match(builder, /grade: quickGrade\.trim\(\)/);
  assert.match(builder, /canAddToDistinta=\{draftReady && !restoreCandidate/);
});
