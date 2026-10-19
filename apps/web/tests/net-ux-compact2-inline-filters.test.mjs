import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const pro=read("../app/(italian)/(workspace)/network/page.tsx");
const free=read("../components/free-network-directory.tsx");
const ui=read("../components/network-compact-experience.tsx");
const search=read("../lib/network-compact-directory.ts");

test("COMPACT2 keeps technical filters inside the same compact page",()=>{
 for(const key of ["product","capability","market","country"]){
  assert.match(ui,new RegExp('name="'+key+'"'));
  assert.match(pro,new RegExp("params\\."+key));
  assert.match(free,new RegExp("filters\\."+key));
 }
 assert.match(ui,/name=\{group.name\}/);
 assert.match(ui,/Applica filtri/);
 assert.match(ui,/Paese/);
 assert.match(ui,/Regione/);
 assert.match(ui,/Azzera/);
 assert.match(ui,/Modalità \{accessMode===/);
 assert.doesNotMatch(ui,/Filtri tecnici: prodotto, capability, mercato e paese/);
 assert.match(pro,/const needsTechnicalFinder=Boolean\(params.advanced==="1"\|\|params.province\|\|params.city\)/);
});
test("COMPACT2 respects tenant guard, accurate totals and 6 per page",()=>{
 assert.match(search,/await getNetworkBrowsePage\(organizationId,access,"published"/);
 assert.match(search,/const data=await searchNetwork/);
 assert.match(search,/COMPACT_NETWORK_PAGE_SIZE=6/);
 assert.match(search,/technicalOnly:true/);
 assert.match(search,/capabilityLabels:Object.fromEntries/);
 assert.match(search,/published:total,discovered:0/);
 assert.match(ui,/Le aziende censite senza attributi tecnici non sono incluse/);
 assert.match(ui,/capabilityLabels\[company.id\]/);
});
test("COMPACT2 searching preserves active filters without stale page numbers",()=>{
 assert.match(ui,/name="q"/);
 assert.match(ui,/name="region"/);
 assert.match(ui,/name="role"/);
 for(const key of ["product","capability","market","country"]){
  assert.match(ui,new RegExp('name="'+key+'"'));
 }
 assert.match(ui,/key!=="np"/);
 assert.match(free,/return <NetworkRecoveryScreen \/>/);
});
