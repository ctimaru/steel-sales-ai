import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = p => readFileSync(new URL(p,import.meta.url),"utf8");
const bar=read("../components/network-inventory-bar.tsx");
const map=read("../components/italy-region-map.tsx");
const free=read("../components/free-network-directory.tsx");
const pro=read("../app/(italian)/(workspace)/network/page.tsx");

test("NET-LAUNCH5B provides simple keyboard-accessible map and company shortcuts",()=>{
 assert.match(bar,/aria-label="Esplora il Network"/);
 assert.match(bar,/href="#network-regional-map"/);
 assert.match(bar,/href="#network-company-list"/);
 assert.match(map,/network-regional-map/);
 assert.match(free,/id="network-company-list"/);
 assert.match(pro,/id="network-company-list"/);
});
test("NET-LAUNCH5B preserves server-derived Free Pro and unconfirmed source counts",()=>{
 assert.match(bar,/accessMode==="pro"\?"Pro":"Free"/);
 assert.match(bar,/published\+unconfirmed/);
 assert.match(bar,/Da confermare/);
});
