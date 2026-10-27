import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const page=readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx",import.meta.url),"utf8");
const builder=readFileSync(new URL("../components/buyer-distinta-builder.tsx",import.meta.url),"utf8");
test("Commerciale exposes the existing RFQAI assistant without a second RFQ builder",()=>{
 assert.match(page,/commercial-ai-intake-link/);
 assert.match(page,/\?compose=1#commercial-ai-intake/);
 assert.match(page,/canWrite \? \(/);
 assert.match(page,/<BuyerDistintaBuilder/);
 assert.match(builder,/useState<RfqAiIntakeMode>\(returnToCommercial && workspace \? "text" : "manual"\)/);
 assert.match(builder,/id="commercial-ai-intake" open=\{returnToCommercial && workspace\}/);
 assert.match(builder,/Assistente AI · descrivi il materiale, prepara la distinta/);
 assert.match(builder,/<RfqAiIntakeUx/);
 assert.match(builder,/onInsertTextLines=\{insertRfqAiTextLines\}/);
});
