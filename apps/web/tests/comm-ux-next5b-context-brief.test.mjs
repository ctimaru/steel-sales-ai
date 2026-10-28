import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const src=readFileSync(new URL("../components/commercial-unified-worklist.tsx",import.meta.url),"utf8");
test("selected deal fact brief uses only grounded visible fields without automatic AI disclosure",()=>{
 assert.match(src,/data-testid="commercial-deal-fact-brief"/);
 assert.match(src,/itemType\(item\)/);
 assert.match(src,/detail\?\.status \?\? item\.status/);
 assert.match(src,/item\.title/);
 assert.match(src,/item\.origin/);
 assert.match(src,/non vengono dedotti da questa sintesi/);
 assert.match(src,/href=\{appRoutes\.commercial\.assistant\}/);
 assert.doesNotMatch(src,/href=\{[^}]*encodeURIComponent\(item\./);
});
