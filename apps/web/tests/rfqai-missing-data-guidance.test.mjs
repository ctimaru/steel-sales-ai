import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const review=readFileSync(new URL("../components/rfq-ai-text-review.tsx",import.meta.url),"utf8");

test("RFQAI missing-data guidance never supplies technical defaults",()=>{
  assert.match(review,/function missingFieldQuestions\(raw: RfqAiRawLine, shape: TubeShape\)/);
  for(const field of ["outerDiameterMm","widthMm","heightMm","thicknessMm","standard","grade","quantity","quantityUnit","lengthMm"])
    assert.ok(review.includes("missing(raw."+field+")"),field+" must be checked");
  assert.match(review,/data-rfqai-missing-questions/);
  assert.match(review,/Nessun valore viene inventato/);
  assert.match(review,/missingQuestions\.map/);
  assert.match(review,/candidate\.issues\.some/);
  assert.match(review,/calculateBuyerDistintaLine\(row\.proposedLine\)\.complete/);
  assert.match(review,/confirmed\[candidate\.candidateId\] && canConfirm\(candidate\)/);
});
