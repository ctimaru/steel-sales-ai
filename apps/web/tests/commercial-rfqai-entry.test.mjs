import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const page=readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx",import.meta.url),"utf8");
const builder=readFileSync(new URL("../components/buyer-distinta-builder.tsx",import.meta.url),"utf8");
test("Commerciale exposes the existing RFQAI assistant without a second RFQ builder",()=>{
 assert.match(page,/legacyComposeRedirect\(params\)/);
 assert.match(page, /legacyComposeRedirect\(params\)/);
 assert.match(page,/canWrite \? \(/);
 assert.doesNotMatch(page, /<BuyerDistintaBuilder/);
 assert.match(builder,/useState<RfqAiIntakeMode>\(focusAiIntake && workspace \? "text" : "manual"\)/);
 // DISTINTA-SMART1: the focused intake is the single box, anchored for the home handoff.
 assert.match(builder,/<div id="commercial-ai-intake" className="scroll-mt-20">/);
 assert.match(builder,/focusedView=\{\(controls\) => \(/);
 assert.match(builder,/<RfqAiIntakeUx/);
 assert.match(builder,/onInsertTextLines=\{insertRfqAiTextLines\}/);
});
