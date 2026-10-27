import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const it=readFileSync(new URL("../app/(italian)/page.tsx",import.meta.url),"utf8");
const en=readFileSync(new URL("../app/(english)/en/page.tsx",import.meta.url),"utf8");
const proof=readFileSync(new URL("../components/public-steel-geometry-proof.tsx",import.meta.url),"utf8");
test("8F gallery remains primary tool discovery and knowledge shelf is complementary",()=>{
 assert.match(it,/<HomeCinematicTools locale="it"/);
 assert.match(en,/<HomeCinematicTools locale="en"/);
 assert.match(it,/label: "Norme"/);
 assert.match(it,/label: "Gradi"/);
 assert.match(it,/label: "Calcolo pesi"/);
 assert.match(it,/label: "Crea distinta"/);
 assert.match(it,/href: "\/knowledge\/norme"/);
 assert.match(it,/href: "\/knowledge\/gradi"/);
 assert.match(proof,/id="steel-tools-proof"/);
 assert.match(proof,/href=\{calcHref\}/);
 assert.match(proof,/href=\{billHref\}/);
});
