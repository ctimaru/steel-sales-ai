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
 assert.match(src,/<CommercialDealFactBriefCopy kind=\{itemType\(item\)\}/);
 assert.doesNotMatch(src,/href=\{[^}]*encodeURIComponent\(item\./);
});

test("copy to assistant requires manual action and exposes provenance caveat",()=>{
 const copy=readFileSync(new URL("../components/commercial-deal-fact-brief-copy.tsx",import.meta.url),"utf8");
 assert.match(copy,/"use client"/);
 assert.match(copy,/onClick=\{\(\) => void copyFacts\(\)\}/);
 assert.match(copy,/navigator\.clipboard\.writeText/);
 assert.match(copy,/Non dedurre offerte, email o documenti/);
 assert.match(copy,/aria-live="polite"/);
 assert.match(copy,/aria-pressed=\{question === option\}/);
 assert.match(copy,/Domanda: " \+ question/);
 assert.match(copy,/setQuestion\(option\)/);
});

test("explicit copy-and-open handoff routes only after clipboard success",()=>{
 const copy=readFileSync(new URL("../components/commercial-deal-fact-brief-copy.tsx",import.meta.url),"utf8");
 assert.match(copy,/onClick=\{\(\) => void copyFacts\(true\)\}/);
 assert.match(copy,/if \(openAssistant\) router\.push\(appRoutes\.commercial\.assistant\)/);
 assert.ok(copy.indexOf("await navigator.clipboard.writeText(text)") < copy.indexOf("if (openAssistant) router.push"));
 assert.match(copy,/Copia e apri assistente/);
});
