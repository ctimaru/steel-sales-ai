import assert from "node:assert/strict";
import {readFileSync} from "node:fs";import {test} from "node:test";
const s=readFileSync(new URL("../app/(italian)/(public)/knowledge/tubes/[slug]/page.tsx",import.meta.url),"utf8");
test("CTR title pilot limited to observed Italian dimension pages",()=>{
 for(const slug of ["tondo-114-3x6-02","quadro-120x120x10","quadro-250x250x8","rettangolare-200x100x6"])assert.ok(s.includes('"'+slug+'"'));
 assert.match(s,/ctrPilotSlugs\.has\(dimension\.dimension_slug\)/);
 assert.match(s,/formatNumber\(dimension\.weight_kg_m\) \+ " kg\/m e barre"/);
 assert.match(s,/canonical: absoluteUrl\("\/knowledge\/tubes\/" \+ dimension\.dimension_slug\)/);
});
