import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source=readFileSync(new URL("../components/rfq-ai-text-review.tsx",import.meta.url),"utf8");
test("RFQAI conversational experience progressively reveals full technical editor",()=>{
  const prompt=source.indexOf('data-rfqai-quick-reply');
  const details=source.indexOf('data-rfqai-technical-details');
  const grid=source.indexOf('className="rfqai3-candidate-grid"');
  const issues=source.indexOf('{candidate.issues.length ? (');
  assert.ok(prompt>0 && prompt<details && details<grid && grid<issues);
  assert.match(source,/defaultOpen=\{!nextQuickField\}/);
  assert.match(source,/Verifica e modifica tutti i dati tecnici/);
  assert.match(source,/data-rfqai-missing-questions/);
  assert.match(source,/calculateBuyerDistintaLine\(row\.proposedLine\)\.complete/);
  assert.match(source,/confirmed\[candidate\.candidateId\] && canConfirm\(candidate\)/);
  assert.match(source,/onInsert\(selected\.map/);
});
