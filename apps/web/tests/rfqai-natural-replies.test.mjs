import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const s=readFileSync(new URL("../components/rfq-ai-text-review.tsx",import.meta.url),"utf8");
test("Natural replies use active-question context and preserve explicit units",()=>{
  for(const token of ['Only the active question determines meaning','cinque: "5"','sei: "6"','numberPhrase.match(matcher)','quantityUnit: "PZ"','quantityUnit: "M"','quantityUnit: "T"','calculateBuyerDistintaLine(row.proposedLine).complete','setConfirmed((previous) => ({ ...previous, [candidate.candidateId]: false })'])
    assert.ok(s.includes(token), token);
  assert.ok(!s.includes('fetch('));
});
