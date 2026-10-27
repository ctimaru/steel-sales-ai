import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const src=readFileSync(new URL("../components/rfq-ai-text-review.tsx",import.meta.url),"utf8");
test("RFQAI recovery 2 validates commercial replies without implicit specifications",()=>{
  for(const item of ['field === "standard"','field === "quantityUnit"','field === "grade"','field === "quantity"','["EN 10219", "EN 10210"]','["PZ", "M", "T"]','data-rfqai-quick-reply','change(candidate, { [field]:','canConfirm(candidate)','nextQuickField === "grade"'])
    assert.ok(src.includes(item),item);
  assert.match(src,/Seleziona o inserisci un valore valido/);
  assert.match(src,/Forma del tubo/);
  assert.match(src,/setConfirmed\(\(previous\) => \(\{ \.\.\.previous, \[candidate\.candidateId\]: false \}\)\)/);
});
