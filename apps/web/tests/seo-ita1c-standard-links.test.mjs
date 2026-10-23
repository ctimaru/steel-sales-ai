import assert from "node:assert/strict";import { readFileSync } from "node:fs";import { test } from "node:test";
const source=readFileSync(new URL("../app/(italian)/(public)/knowledge/tubes/[slug]/page.tsx",import.meta.url),"utf8");
test("document standard contextual links use evidence, not guessed product conformity",()=>{
 assert.match(source,/\["en10210", "en10219", "en10216-2"\]\.includes\(provenance\.standard/);
 assert.match(source,/href=\{`\/knowledge\/norme\/\$\{provenance\.standard\.replace/);
 assert.match(source,/sourceStandardLabel\(provenance\.standard, "it"\)/);
 assert.match(source,/non certifica conformità EN 10219 o EN 10210/);
});
