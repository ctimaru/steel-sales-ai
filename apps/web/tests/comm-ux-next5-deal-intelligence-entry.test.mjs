import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const src=readFileSync(new URL("../components/commercial-unified-worklist.tsx",import.meta.url),"utf8");
test("Deal intelligence links to existing private assistant without sharing a deal automatically",()=>{
 assert.match(src,/data-testid="commercial-deal-memory-entry"/);
 assert.match(src,/href=\{appRoutes\.commercial\.assistant\}/);
 assert.match(src,/La ricerca nell’assistente è manuale/);
 assert.match(src,/non viene condivisa o analizzata automaticamente/);
 assert.match(src,/data-testid="commercial-deal-next-step"/);
});
