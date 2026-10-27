import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../components/calculator-inline-distinta-experience.tsx",import.meta.url),"utf8");
test("FLOW-CALC-RFQ.2 login carries a same-tab draft resume route",()=>{
 assert.match(source,/CALCULATOR_ROUTES\[locale\]\+"\?resume=rfq"/);
 assert.match(source,/target="_top" href=\{"\/login\?next="/);
 assert.match(source,/new URLSearchParams\(window.location.search\).get\("resume"\) === "rfq"/);
 assert.match(source,/if \(restored\?\.lines.length\)/);
 assert.match(source,/setOpen\(true\)/);
 assert.match(source,/readInlineDistintaSession\(window.sessionStorage\)/);
 assert.doesNotMatch(source,/createPrivateRfq\(\).*setOpen\(true\)/);
});
