import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const root = new URL("../", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");
test("CRAWL-IT5 uses geography only when requested and preserves M6 query contract", () => {
 const lib=read("lib/network.ts");
 assert.match(lib,/isGeo \? "m6_search_network_geo" : "m6_search_network"/);
 assert.match(lib,/p_region: filters.region/);
 assert.match(lib,/p_province: filters.province/);
 assert.match(lib,/p_city: filters.city/);
});
test("CRAWL-IT5 keeps UX honest about unverified ISTAT provinces", () => {
 const page=read("app/(workspace)/network/page.tsx");
 for(const name of ["region","province","city"]) assert.match(page,new RegExp('name="'+name+'"'));
 assert.match(page,/disabled=\{!geoFacets.provinces.length\}/);
 assert.match(page,/La provincia sarà disponibile dopo la verifica ISTAT/);
});
test("CRAWL-IT5 search enforces published facility and company evidence", () => {
 const sql=read("../../supabase/migrations/20261011101000_crawl_it5_network_geo_filters.sql");
 assert.match(sql,/f.publication_status='published'/);
 assert.match(sql,/c.publication_status='published'/);
 assert.match(sql,/g.status='approved'/);
 assert.match(sql,/m6_network_geo_facets/);
});
