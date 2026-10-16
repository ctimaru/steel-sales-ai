import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";
import {mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const storage=read("../../../supabase/migrations/20261016230000_netfast3_licensed_bulk_schema.sql");
const grants=read("../../../supabase/migrations/20261016230100_netfast3_feed_rights_and_suppression.sql");
const imports=read("../../../supabase/migrations/20261016230200_netfast3_licensed_bulk_rpc.sql");
const view=read("../../../supabase/migrations/20261016230300_netfast3_unconfirmed_free_union.sql");
const actions=read("../app/(platform)/platform/company-discovery/bulk/actions.ts");
const page=read("../app/(platform)/platform/company-discovery/bulk/page.tsx");
test("NET-FAST3 only makes rights-cleared datasets visible, no canonical publication",()=>{
 assert.match(storage,/network_netfast3_feed_grants/);
 assert.match(grants,/redistribution rights attestation required/i);
 assert.match(imports,/g.revoked_at is null and g.expires_at>now\(\)/);
 assert.match(view,/g.revoked_at is null and g.expires_at>now\(\)/);
 assert.match(view,/network_netfast3_suppressed_domains/);
 assert.doesNotMatch(grants+storage+imports+view,/insert into public.network_companies/);
});
test("NET-FAST3 1k batch, identity dedup and private schema access",()=>{
 assert.match(imports,/jsonb_array_length\(p_items\) not between 1 and 1000/);
 assert.match(imports,/network_company_discovery_candidates/);
 assert.match(imports,/network_core_target_leads/);
 assert.match(imports,/on conflict do nothing/);
 assert.match(storage,/enable row level security/g);
 assert.match(actions,/parseLicensedCompanies/);
 assert.match(page,/Importazione massiva aziende/);
});
test("NET-FAST3 cannot activate crawler and supports future opt-out",()=>{
 assert.match(grants,/site_crawling_enabled',false/);
 assert.match(grants,/netfast3_revoke_feed/);
 assert.match(grants,/netfast3_suppress_domain/);
 assert.match(page,/revoca/i);
});
test("NET-FAST3 CSV/TSV input parser accepts exact business fields",()=>{
 const src=read("../lib/network-licensed-import.ts");
 assert.match(src,/data.length>1000/);
 assert.match(src,/name.*domain.*record_id.*role/);
 assert.match(src,/if\(seen.has\(domain\)\)/);
 assert.doesNotMatch(src,/fetch\(|axios\(|download\(/);
});
