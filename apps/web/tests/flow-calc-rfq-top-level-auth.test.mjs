import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const code=readFileSync(new URL("../components/calculator-inline-distinta-experience.tsx",import.meta.url),"utf8");
test("FLOW-CALC-RFQ authentication exits embedded calculator iframe without losing draft contract",()=>{
 for(const path of ['href="/register" onClick','href={"/login?next="+encodeURIComponent(CALCULATOR_ROUTES[locale]+"?resume=rfq")}','href="/register" className','href="/registration/status" className']) {
  assert.ok(code.includes('target="_top" '+path), "Top-level navigation missing for "+path);
 }
 assert.match(code,/persistInlineDistintaSession/);
 assert.match(code,/createPrivateRfqOneStep/);
 assert.match(code,/access\.state !== "ready"/);
 assert.match(code,/setRfqAccess\(access\.state\)/);
});
