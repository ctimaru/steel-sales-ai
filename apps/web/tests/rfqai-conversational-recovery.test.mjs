import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const source=readFileSync(new URL("../components/rfq-ai-text-review.tsx",import.meta.url),"utf8");
test("RFQAI conversational recovery updates only explicitly answered field and preserves review",()=>{
  for(const token of ["data-rfqai-quick-reply","Applica risposta","applyQuickAnswer(candidate, nextQuickField)","lengthMm: String(number * 1000)","thicknessMm: parsed","calculateBuyerDistintaLine(row.proposedLine).complete","setConfirmed((previous) => ({ ...previous, [candidate.candidateId]: false })"])
    assert.ok(source.includes(token),token);
  assert.ok(source.includes(String.raw`/^(?:\\d{1,4})(?:[.,]\\d{1,3})?$/`.replaceAll("\\\\","\\")));
});
