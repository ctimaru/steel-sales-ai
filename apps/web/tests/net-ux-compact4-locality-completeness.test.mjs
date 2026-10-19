import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const page=read("../components/network-compact-experience.tsx");
const listing=read("../lib/network-compact-directory.ts");
const geo=read("../lib/network-compact-geo.ts");
const facade=read("../../supabase/migrations/20261019103000_netcompact4_geo_evidence_overlay.sql");
const region=read("../../supabase/migrations/20261019103500_netcompact4_sourced_region_filter.sql");
const security=read("../../supabase/tests/hp13_permissions_tenant_isolation.sql");

test("COMPACT4 shows published or sourced locality without claiming a verified office",()=>{
  assert.match(page,/Località indicativa/);
  assert.match(page,/Località da integrare/);
  assert.match(page,/Fonte località ↗/);
  assert.match(page,/safeNetworkWebsiteUrl\(company.geo_source_url\)/);
  assert.match(page,/Località disponibili: \{listedLocationCount\}\/\{directory.items.length\}/);
  assert.match(page,/geography_status==="sourced_unverified"/);
  assert.match(page,/aria-label=\{"Fonte della località indicativa di "\+name\}/);
  assert.doesNotMatch(page,/geography_status==="sourced_unverified".*?Azienda verificata/s);
});

test("COMPACT4 hydrates only currently paged Free and Pro rows",()=>{
  assert.match(listing,/await withCompactGeoEvidence\(organizationId,access,items\)/);
  assert.match(listing,/await withCompactGeoEvidence\(organizationId,access,\[\.\.\.publishedItems,\.\.\.discoveredItems\]\)/);
  assert.match(geo,/items.map\(company=>company.id\).slice\(0,24\)/);
  assert.match(geo,/p_organization_id:organizationId,p_access:access,p_company_ids:ids/);
  assert.match(geo,/if\(error\|\|!data\|\|typeof data!=="object"\)return items/);
  assert.match(geo,/const hasExisting=Boolean\(existing\?\.city\|\|existing\?\.region\)/);
  assert.match(geo,/geo_source_url:sourced.geography_status==="sourced_unverified"/);
});

test("COMPACT4 geographic RPC rejects anonymous and cross-tenant lookup",()=>{
  assert.match(facade,/\(select auth.uid\(\)\) is null/);
  assert.match(facade,/private.netux11_require_active_company\(p_organization_id\)/);
  assert.match(facade,/private.pa1_3_require_network_access\(p_organization_id\)/);
  assert.match(facade,/array_length\(p_company_ids, 1\)/);
  assert.match(facade,/revoke all on function public.netcompact4_geo_overlay/);
  assert.match(facade,/grant execute on function public.netcompact4_geo_overlay\(uuid,text,uuid\[\]\) to authenticated/);
  assert.match(security,/'netcompact4_geo_overlay'/);
});

test("COMPACT4 accepts only grounded location evidence with exact website domain and no conflicts",()=>{
  assert.match(facade,/g.status='pending_review'/);
  assert.match(facade,/lower\(btrim\(g.source_company_domain\)\)=lower\(btrim\(c.website_domain\)\)/);
  assert.match(facade,/g.status='source_observed'/);
  assert.match(facade,/g.source_url like 'https:\/\/%'/);
  assert.match(facade,/published_locations/);
  assert.doesNotMatch(facade,/g.status='conflict'/);
  assert.match(region,/ge.status='pending_review'/);
  assert.match(region,/ge.source_url like 'https:\/\/%'/);
  assert.match(region,/lower\(btrim\(ge.region\)\)=lower\(btrim\(p_region\)\)/);
  assert.match(region,/private.netux11_require_active_company\(p_organization_id\)/);
});
