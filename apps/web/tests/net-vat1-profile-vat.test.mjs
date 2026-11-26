// NET-VAT1 (founder, 26 nov 2026): la P.IVA trovata sul sito ufficiale va nel
// profilo e si vede sulla scheda Network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const sql = read("../../../supabase/migrations/20261126133000_net_vat1_firstparty_vat.sql");
const lib = read("../lib/network-vat.ts");
const overview = read("../components/network-profile-overview.tsx");
const pro = read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const free = read("../components/free-network-profile.tsx");

test("database: una sola via di scrittura, valida, dal dominio ufficiale, mai sovrascrive", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION private\.net_vat1_it_vat_ok/);
  assert.match(sql, /'not_official_site'/);
  assert.match(sql, /'vat_in_use'/);
  assert.match(sql, /'company_has_other_vat'/);
  assert.match(sql, /'vat_on_multiple_companies'/);
  assert.match(sql, /UPDATE public\.network_companies SET vat_id = v_vat WHERE id = p_company_id;/);
  assert.equal((sql.match(/UPDATE public\.network_companies/g) ?? []).length, 1);
  assert.match(sql, /IF auth\.role\(\) IS DISTINCT FROM 'service_role'/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.net_vat1_sweep\(integer\) TO service_role;/);
});

test("lettura pubblica: solo utenti autenticati e profili pubblicati", () => {
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.net_vat1_public_company_vat\(uuid\) FROM PUBLIC, anon;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.net_vat1_public_company_vat\(uuid\) TO authenticated;/);
  assert.match(sql, /auth\.uid\(\) IS NOT NULL AND n\.id = p_company_id\s+AND n\.publication_status = 'published' AND n\.archived_at IS NULL/);
  assert.match(lib, /^import "server-only";/);
  assert.match(lib, /rpc\("net_vat1_public_company_vat"/);
});

test("scheda: P.IVA accanto alla ragione sociale in entrambe le viste", () => {
  assert.match(overview, /\(countryCode === "IT" \? "P\.IVA " : "VAT "\) \+ vatId/);
  assert.match(overview, /data-testid="network-profile-identity"/);
  assert.match(pro, /getNetworkCompanyVat\(id\)/);
  assert.match(pro, /vatId=\{vatId\}/);
  assert.match(free, /provisional \? Promise\.resolve\(null\) : getNetworkCompanyVat\(companyId\)/);
  assert.match(free, /vatId=\{vatId\}/);
});
