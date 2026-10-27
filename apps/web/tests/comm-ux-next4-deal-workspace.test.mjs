import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const src=readFileSync(new URL("../components/commercial-unified-worklist.tsx",import.meta.url),"utf8");
test("Commerciale selected deal exposes contextual next step without automating an outbound action",()=>{
 assert.match(src,/data-testid="commercial-deal-next-step"/);
 assert.match(src,/href=\{item\.href\}/);
 assert.match(src,/canWrite \? "Continua →" : "Apri dettaglio →"/);
 assert.match(src,/item\.kind === "campaign"/);
 assert.match(src,/item\.kind === "quote"/);
 assert.match(src,/item\.kind === "purchase-order"/);
 assert.match(src,/verificare risposte e destinatari/);
 assert.match(src,/data-testid="commercial-smart-deal-card"/);
 assert.match(src,/<CommercialCampaignOperations/);
});
