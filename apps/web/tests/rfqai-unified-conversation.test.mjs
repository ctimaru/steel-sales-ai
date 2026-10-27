import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const intake=readFileSync(new URL("../components/rfq-ai-intake-ux.tsx",import.meta.url),"utf8");
const review=readFileSync(new URL("../components/rfq-ai-text-review.tsx",import.meta.url),"utf8");
test("RFQAI unified conversation keeps source editable and explicit analysis and review",()=>{
  assert.match(intake,/Ciao, dimmi quale materiale stai cercando/);
  assert.match(intake,/Completiamo insieme la tua richiesta/);
  assert.match(intake,/data-rfqai-original-request/);
  assert.match(intake,/open=\{!textResult\}/);
  assert.match(intake,/Visualizza o modifica la richiesta originale/);
  assert.match(intake,/onClick=\{analyzeText\}/);
  assert.match(intake,/<RfqAiTextReview/);
  assert.match(review,/data-rfqai-quick-reply/);
  assert.match(review,/data-rfqai-technical-details/);
  assert.match(review,/confirmed\[candidate\.candidateId\] && canConfirm\(candidate\)/);
  assert.match(intake,/if \(!onInsertTextLines\(items\)\) return false/);
});
