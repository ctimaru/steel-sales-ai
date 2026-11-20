import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const query=read("../lib/network-compact-directory.ts");
const reader=read("../lib/network-free.ts");
const map=read("../components/network-europe-map.tsx");
const ticker=read("../components/network-country-ticker.tsx");
const ui=read("../components/network-compact-experience.tsx");
const migration=read("../../../supabase/migrations/20261120102047_netux_filters3_authenticated_country_browse.sql");
const hp13=read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");

test("FILTERS3: foreign Free/Pro countries use country-scoped, access-checked results, not M6 Pro-RLS",()=>{
  assert.match(reader,/export async function getNetworkCountryPage/);
  assert.match(reader,/supabase\.rpc\("netux_filters3_country_page"/);
  assert.match(reader,/p_organization_id:organizationId,p_access:access,p_country:filters\.country/);
  assert.match(reader,/page\.contract!=="netux-filters3-country-v1"/);
  assert.match(query,/if\(filters\.country && filters\.country!=="IT"\)/);
  const foreign=query.indexOf('if(filters.country && filters.country!=="IT"){');
  const technical=query.indexOf("if(technicalOnly){");
  assert.ok(foreign>0&&technical>foreign,"Country branch must run before M6 technical lookup");
  const countryBranch=query.slice(foreign,technical);
  assert.match(countryBranch,/await getNetworkCountryPage\(organizationId,access,/);
  assert.match(countryBranch,/country:filters\.country/);
  assert.match(countryBranch,/product:filters\.product,capability:filters\.capability,market:filters\.market/);
  assert.match(countryBranch,/items:selected\.items,total,published:total,discovered:0/);
  assert.doesNotMatch(countryBranch,/searchNetwork\(/);
});

test("FILTERS3: server RPC checks active Free membership and Pro entitlement without changing RLS",()=>{
  assert.match(migration,/p_access='free' then\s+perform private\.netux11_require_active_company\(p_organization_id\)/);
  assert.match(migration,/p_access='pro' then\s+perform private\.pa1_3_require_network_access\(p_organization_id\)/);
  assert.match(migration,/c\.publication_status='published' and c\.archived_at is null/);
  assert.match(migration,/c\.country_code=v_country/);
  assert.match(migration,/p_role not in \('producer'/);
  assert.match(migration,/revoke all on function private\.netux_filters3_country_page_impl/);
  assert.match(migration,/grant execute on function public\.netux_filters3_country_page/);
  assert.match(migration,/to authenticated;/);
  assert.doesNotMatch(migration,/grant\s+(?:all|execute)\s+on\s+function[^;]*to\s+anon/);
  assert.match(hp13,/'netux_filters3_country_page'/);
  assert.match(hp13,/NET-UX-FILTERS3 country page must retain Free\/Pro guards/);
});

test("FILTERS3: country clicks use client-side App Router updates without a document navigation",()=>{
  assert.match(ticker,/import Link from "next\/link"/);
  assert.match(ticker,/return <Link scroll=\{false\}/);
  assert.match(map,/import \{useRouter\} from "next\/navigation"/);
  assert.match(map,/startTransition\(\(\)=>router\.replace\(href,\{scroll:false\}\)\)/);
  assert.match(map,/event\.preventDefault\(\)/);
  assert.match(map,/onNavigate\(href,"country"\)/);
  assert.match(map,/aria-live="polite"/);
  assert.doesNotMatch(map,/window\.location\.(?:href|assign|replace|reload)/);
  assert.match(ui,/data-testid="network-count-summary"/);
  assert.match(ui,/data-testid="network-count-visible"/);
});
