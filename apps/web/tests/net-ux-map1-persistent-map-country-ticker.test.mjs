import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const ui=read("../components/network-compact-experience.tsx");
const ticker=read("../components/network-country-ticker.tsx");
const flags=read("../components/network-country-flag.tsx");
const css=read("../components/network-country-ticker.module.css");
const data=read("../lib/network-country-stats.ts");
const sql=read("../../../supabase/migrations/20261105150152_netux_map1_country_stats.sql");

test("MAP1: Romanian flag uses same vector component and dimensions as Italy in ticker and cards",()=>{
  assert.match(flags,/NetworkFlagCountry="IT"\|"RO"/);
  assert.match(flags,/supported=new Set<string>\(\["IT","RO"/);
  const ro=flags.match(/case "RO":return <>[\s\S]*?<\/\>;/)?.[0]||"";
  assert.match(ro,/<rect width="8" height="16" fill="#002b7f"\/>/);
  assert.match(ro,/<rect x="8" width="8" height="16" fill="#fcd116"\/>/);
  assert.match(ro,/<rect x="16" width="8" height="16" fill="#ce1126"\/>/);
  assert.match(flags,/w-6/);
  assert.match(flags,/aria-hidden="true"/);
  assert.match(ticker,/<NetworkCountryFlag code=\{item.countryCode\}\/>/);
  assert.match(ui,/<NetworkCountryFlag code=\{countryCode\}\/>/);
});

test("MAP1: European map is first in the sidebar, outside the mobile filter drawer",()=>{
  const side=ui.indexOf('data-testid="network-side-column"');
  const map=ui.indexOf('data-testid="network-europe-persistent-map"');
  const drawer=ui.indexOf("<NetworkFilterDrawer activeCount=");
  const role=ui.indexOf('Ruolo nella filiera</p>');
  assert.ok(side>=0&&map>side&&drawer>map&&role>drawer);
  assert.equal((ui.match(/<NetworkEuropeanMap /g)||[]).length,1);
  assert.doesNotMatch(ui,/<details className="rounded-xl border[^\n]*network-compact-mobile-map/);
});

test("MAP1: banner precedes the two-column layout and retains safe motion",()=>{
  assert.ok(ui.indexOf("<NetworkCountryTicker ")<ui.indexOf('data-testid="network-europe1d-one-screen-shell"'));
  assert.match(ticker,/getNetworkCountryStats\(organizationId,accessMode\)/);
  assert.match(ticker,/encodeURIComponent\(item.countryCode\)/);
  for(const label of ["produttori","commercianti","terzisti","utilizzatori","profili pubblicati","da confermare"])
    assert.ok(ticker.includes(label),label);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/focus-within/);
  assert.match(ticker,/aria-hidden="true"/);
});

test("MAP1: counts are live, scoped and do not present private research as published",()=>{
  assert.match(data,/supabase\.rpc\("netux_map1_country_stats"/);
  assert.match(data,/netux-map1-country-stats-v1/);
  assert.match(data,/producer!\+trader!\+processor!\+endUser!\+other! !==total/);
  assert.match(sql,/private\.netux11_require_active_company\(p_organization_id\)/);
  assert.match(sql,/private\.pa1_3_require_network_access\(p_organization_id\)/);
  assert.match(sql,/private\.netfast_discovered_records/);
  assert.match(sql,/c\.publication_status='published' and c\.archived_at is null/);
  assert.doesNotMatch(sql,/network_web_research_seeds/);
  assert.match(sql,/revoke all on function private\.netux_map1_country_stats_impl/);
  assert.match(sql,/grant execute on function public\.netux_map1_country_stats\(uuid,text\) to authenticated/);
});

test("MAP1: production ACL repair and reviewed HP13 guard are versioned",()=>{
 const acl=read("../../../supabase/migrations/20261105160954_netux_map1_country_stats_facade_acl.sql");
 const hp13=read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");
 assert.ok(acl.includes("alter function public.netux_map1_country_stats(uuid,text) security definer"));
 assert.ok(acl.includes("revoke all on function private.netux_map1_country_stats_impl(uuid,text)"));
 assert.ok(acl.includes("grant execute on function public.netux_map1_country_stats(uuid,text)"));
 assert.ok(hp13.includes("'netux_map1_country_stats'"));
 assert.ok(hp13.includes("NET-UX-MAP1 country statistics facade must be pinned"));
});
