import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const page=readFileSync(new URL("../app/(italian)/(platform)/platform/acquisition/page.tsx",import.meta.url),"utf8");
test("acquisition route requires platform owner and is non-indexable",()=>{
 assert.match(page,/await requirePlatformConsoleContext\(\)/);
 assert.match(page,/if \(!context\.is_platform_owner\) notFound\(\)/);
 assert.match(page,/robots: \{ index: false, follow: false \}/);
});
test("no synthetic or client-stored analytics counts are shown",()=>{
 assert.match(page,/gsc: null, ga4: null, events: null/);
 assert.doesNotMatch(page,/process\.env|NEXT_PUBLIC_|localStorage|fetch\(/);
});
