import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../../supabase/migrations/20261016113000_netux11_free_network_read.sql");
const page = read("../app/(workspace)/network/page.tsx");
const profile = read("../app/(workspace)/network/[id]/page.tsx");
const flags = read("../lib/network-flags.ts");
const directory = read("../components/free-network-directory.tsx");
const freeProfile = read("../components/free-network-profile.tsx");
const rpc = read("../lib/network-free.ts");
const shell = read("../components/app-shell.tsx");
const layout = read("../app/(workspace)/layout.tsx");

test("NET-UX1.1 activates Free read with an explicit rollback flag and preserves PA1.3", () => {
  assert.match(flags, /NETWORK_FREE_READ_ENABLED !== "false"/);
  assert.match(page, /!access\.can_access_network/);
  assert.match(page, /isNetworkFreeReadEnabled\(\)/);
  assert.match(page, /<NetworkAccessGate/);
  assert.match(profile, /await requireNetworkAccess\(\)/);
  assert.match(profile, /FreeNetworkProfileView/);
  assert.match(layout, /networkFreeEnabled/);
  assert.match(shell, /networkEnabled && networkEntitled/);
  assert.match(shell, /networkNav\.slice\(0, 1\)/);
});

test("NET-UX1.1 database keeps PA1.3 restrictive RLS and uses private definer", () => {
  assert.match(migration, /create or replace function private\.netux11_require_active_company/);
  assert.match(migration, /security definer/);
  assert.match(migration, /create or replace function public\.netux11_free_directory/);
  assert.match(migration, /create or replace function public\.netux11_free_profile/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /organization_network_company_links/);
  assert.match(migration, /m\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /m\.status = 'active'/);
  assert.match(migration, /l\.link_status = 'active'/);
  assert.match(migration, /revoke all on function public\.netux11_free_directory[\s\S]*from public, anon/);
  assert.match(migration, /grant execute on function public\.netux11_free_directory[\s\S]*to authenticated/);
  assert.doesNotMatch(migration, /drop policy|alter policy|grant select on table|alter table.*disable row level security/i);
});

test("NET-UX1.1 Free RPC has explicit field allowlist and only published data", () => {
  assert.match(migration, /c\.publication_status = 'published'/);
  assert.match(migration, /f\.publication_status='published'/);
  assert.match(migration, /c\.archived_at is null/);
  for (const forbidden of ["network_contacts", "commercial_threads", "network_inquiries", "rfqs", "orders", "price_history", "network_data_assertions"]) {
    assert.doesNotMatch(migration, new RegExp("from public\\." + forbidden));
  }
  assert.match(directory, /getFreeNetworkDirectory/);
  assert.match(freeProfile, /getFreeNetworkProfile/);
  assert.match(rpc, /netux11_free_directory/);
  assert.match(rpc, /netux11_free_profile/);
  assert.match(rpc, /https:/);
  assert.match(rpc, /http:/);
  assert.doesNotMatch(directory + freeProfile, /followNetworkCompany|saveNetworkCompany|submitNetworkInquiry|requestNetworkClaim/);
});

test("NET-UX1.1 preserves product scope for discovery and shows no synthetic regions", () => {
  assert.match(directory, /orderNetworkDiscovery/);
  assert.match(directory, /data\.regions\.map/);
  assert.match(directory, /Regione non disponibile/);
  assert.match(freeProfile, /Località non ancora disponibili/);
  assert.match(directory, /ItalyRegionMap/);
});
