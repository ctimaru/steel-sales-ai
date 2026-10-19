import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const pro=read("../app/(italian)/(workspace)/network/page.tsx");
const free=read("../components/free-network-directory.tsx");
const ui=read("../components/network-compact-experience.tsx");
const paging=read("../lib/network-compact-directory.ts");
const map=read("../components/network-resilient-first-screen.tsx");

test("COMPACT1 both access modes share the one-screen directory",()=>{
 assert.match(pro,/getCompactNetworkPage\(context.organizationId,"pro",compactFilters\)/);
 assert.match(free,/getCompactNetworkPage\(organizationId,"free",compactFilters\)/);
 assert.match(pro,/<NetworkCompactExperience accessMode="pro"/);
 assert.match(free,/<NetworkCompactExperience accessMode="free"/);
 assert.match(ui,/data-testid="network-compact-experience"/);
 assert.match(ui,/Trova aziende steel/);
 assert.match(ui,/Ricerca e filtri delle aziende/);
});

test("COMPACT1 company rows have one profile action and source-derived attributes",()=>{
 assert.match(ui,/directory.items.map\(company=><CompactCompanyRow/);
 assert.match(ui,/Esplora azienda/);
 assert.match(ui,/company.products.length/);
 assert.match(ui,/capabilityLabels\[company.id\]/);
 assert.match(ui,/company.location\?\.region/);
 assert.doesNotMatch(ui,/Rivendica il profilo|Richiedi connessione/);
 assert.match(ui,/fonti pubbliche/);
});

test("COMPACT1 pagination crosses canonical and discovered boundary",()=>{
 assert.match(paging,/COMPACT_NETWORK_PAGE_SIZE=6/);
 assert.match(paging,/getNetworkBrowsePage\(organizationId,access,"published"/);
 assert.match(paging,/getNetworkBrowsePage\(organizationId,access,"unconfirmed"/);
 assert.match(paging,/compactSourceWindows\(offset,COMPACT_NETWORK_PAGE_SIZE,publishedCount,discoveredCount\)/);
 assert.match(paging,/items:\[\.\.\.publishedItems,\.\.\.discoveredItems\]/);
 assert.match(ui,/aria-label="Pagina successiva"/);
 assert.match(ui,/aria-label="Pagina precedente"/);
});

test("COMPACT1 does not inflate totals or bypass roles and map navigation",()=>{
 assert.match(ui,/discoveryUnavailable/);
 assert.match(ui,/knownTotals\?companyCount/);
 assert.match(ui,/Ruolo indicativo/);
 assert.match(map,/fullMapHref/);
 assert.match(ui,/fullMapHref=/);
 assert.match(free,/filters.map==="1"\?null/);
 assert.match(pro,/getNetworkAccessState\(context.organizationId\)/);
});
