import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const migration = read("../../../supabase/migrations/20261123143000_netprofile_prod1_official_product_pages.sql");
const reader = read("../lib/network-producer-official-pages.ts");
const pro = read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const free = read("../components/free-network-profile.tsx");
const ui = read("../components/network-profile-overview.tsx");

test("PROD1: official product sources are gated by active workspace, company publication and producer role", () => {
  assert.match(migration, /netux11_require_active_company\(p_organization_id\)/);
  assert.match(migration, /pa1_3_require_network_access\(p_organization_id\)/);
  assert.match(migration, /publication_status = 'published'/);
  assert.match(migration, /canonical_key = 'producer'/);
  assert.match(migration, /p\.status = 'processed'/);
  assert.match(migration, /p\.page_kind = 'products'/);
  assert.match(migration, /p\.last_sha256/);
  assert.match(migration, /lower\(p\.canonical_domain\) = lower\(c\.website_domain\)/);
  assert.match(migration, /revoke all on function public\.netprofile_prod1_official_pages/);
  assert.match(migration, /to authenticated;/);
  assert.doesNotMatch(migration, /candidate_review|candidate_evidence|netprofile_data2/i);
});

test("PROD1: Free and Pro show bounded first-party links without promoting them to products", () => {
  assert.match(reader, /netprofile_prod1_official_pages/);
  assert.match(reader, /new URL\(item\.url\)/);
  assert.match(reader, /url\.protocol !== "https:"/);
  assert.match(free, /getNetworkProducerOfficialPages/);
  assert.match(pro, /getNetworkProducerOfficialPages/);
  assert.match(free, /officialProductPages=\{officialProductPages\}/);
  assert.match(pro, /officialProductPages=\{officialProductPages\}/);
  assert.match(ui, /Pagine prodotti sul sito ufficiale/);
  assert.match(ui, /fonti di consultazione, non una conferma di producibilità/);
  assert.match(ui, /rel="noopener noreferrer"/);
});
