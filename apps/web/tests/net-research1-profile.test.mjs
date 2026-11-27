// NET-RESEARCH1 (founder, 26 nov 2026): «Profilo in breve» in «Attività e prodotti».
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const sql = read("../../../supabase/migrations/20261126160000_net_research1_profiles.sql");
const lib = read("../lib/network-research.ts");
const block = read("../components/network-research-profile.tsx");
const overview = read("../components/network-profile-overview.tsx");
const pro = read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const free = read("../components/free-network-profile.tsx");

test("database: fasce, pilota privato, fonti sul dominio ufficiale", () => {
  assert.match(sql, /employees_band IN \(\s*'1-9', '10-49', '50-249', '250-999', '1000\+'\)/);
  assert.match(sql, /revenue_band IN \(\s*'lt2m', '2-10m', '10-50m', '50-250m', 'gt250m'\)/);
  assert.match(sql, /50 - \(SELECT count\(\*\) FROM private\.network_company_research/);
  assert.match(sql, /'Research sources must be on the official domain'/);
  assert.match(sql, /r\.status = 'pilot_review' AND private\.is_platform_superadmin\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.net_research1_company_profile\(uuid\) FROM PUBLIC, anon;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.net_research1_record\(uuid, text, jsonb, boolean\) TO service_role;/);
  assert.doesNotMatch(sql, /'quote'/, "quotes stay private: never returned to the browser");
});

test("scheda: blocco in cima ad Attività e prodotti, anteprima marcata, fonte e fasce", () => {
  assert.match(lib, /^import "server-only";/);
  assert.match(block, /Profilo in breve/);
  assert.match(block, /Anteprima pilota · visibile solo allo staff/);
  assert.match(block, /gt250m: "oltre 250 M€"/);
  assert.match(block, /Da fonte pubblica: ricerca sul sito ufficiale dell'azienda/);
  assert.match(overview, /\{researchContent \?\? null\}\n\s+\{description && !researchContent \? <p/);
  for (const view of [pro, free]) {
    assert.match(view, /researchContent=\{research \? <NetworkResearchProfile research=\{research\}/);
    assert.match(view, /declaredDescription=\{profile\.company\.description_is_company_declared === true \? profile\.company\.description : null\} \/> : undefined\}/);
  }
  assert.match(free, /provisional \? Promise\.resolve\(null\) : getNetworkCompanyResearch\(companyId\)/);
});
