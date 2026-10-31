import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const repo=new URL("../../../",import.meta.url);
const read=(base,path)=>readFileSync(new URL(path,base),"utf8");
const page=read(root,"app/(italian)/(platform)/platform/company-discovery/product-evidence/page.tsx");
const nav=read(root,"app/(italian)/(platform)/platform/company-discovery/steel-coverage/page.tsx");
const ia=read(root,"lib/platform-ia-contract.ts");
const original=read(repo,"supabase/migrations/20261031183100_netgrowth2c2_product_evidence_review.sql");
const sql=read(repo,"supabase/migrations/20261031184000_netgrowth2c2r_product_evidence_integrity.sql");
const tests=read(repo,"supabase/tests/netgrowth2c2_product_evidence_review.sql");
const gate=read(repo,".github/workflows/p0-required-gate.yml");

// Static wiring only. Behaviour (permissions, quarantine, pagination, formats,
// read-only) is executed against the real RPC in
// supabase/tests/netgrowth2c2_product_evidence_review.sql (P0 required gate).

test("NET-GROWTH2C.2R: page is Platform scoped and consumes the v2 integrity contract",()=>{
 assert.match(page,/requirePlatformPermission\("discovery\.read"\)/);
 assert.match(page,/netgrowth2c2_product_evidence_page/);
 assert.match(page,/const PAGE_SIZE=25/);
 assert.match(page,/p_limit:PAGE_SIZE/);
 assert.match(page,/contract==="net-growth2c2-product-review-v2"/);
 assert.match(page,/review_status==="candidate"/);
 assert.match(page,/publication_performed===false/);
 assert.match(page,/quarantined_total===v\.quarantine_by_reason\.discovery_unresolved\+/);
 assert.match(page,/safeNetworkWebsiteUrl\(item\.source_url\)/);
 assert.match(page,/requested>pages\) redirect\(href\(lane,pages\)\)/);
 assert.doesNotMatch(page,/\.from\("network_company_enrichment"\)/);
 assert.match(nav,/company-discovery\/product-evidence/);
 assert.match(ia,/company-discovery\/product-evidence/);
});

test("NET-GROWTH2C.2R: remediation migration quarantines instead of exposing",()=>{
 assert.match(sql,/private\.require_platform_permission\('discovery\.read'\)/);
 assert.match(sql,/'discovery_unresolved'/);
 assert.match(sql,/network_netfast3_suppressed_domains/);
 assert.match(sql,/'canonical_inactive'/);
 assert.match(sql,/where q\.quarantine_reason is null/);
 assert.match(sql,/from public,anon,authenticated,service_role;\s*grant execute on function public\.netgrowth2c2_product_evidence_page\(text,integer,integer\)\s*to authenticated;/);
 assert.doesNotMatch(sql,/\b(insert\s+into|update\s+\w+\.\w+\s+set|delete\s+from)\b/i);
 // The original migration stays byte-stable: ledger safety.
 assert.match(original,/net-growth2c2-product-review-v1/);
});

test("NET-GROWTH2C.2R: behavioural SQL acceptance is wired into the P0 gate",()=>{
 assert.match(gate,/netgrowth2c2_product_evidence_review\.sql/);
 for(const marker of [
  "tenant without discovery.read","'anon'","limit 26","negative offset",
  "all 29 eligible synthetic rows reachable through pagination",
  "quarantined, accepted and non-product evidence never listed",
  "catalogue and publication state unchanged",
 ]) assert.ok(tests.includes(marker),"missing behavioural case: "+marker);
 assert.match(tests,/^rollback;\s*$/m);
});

test("NET-GROWTH2C.2R: named company review document is not in the public tree",()=>{
 assert.equal(existsSync(new URL("docs/network/net-growth2c2-first-25-product-review.md",repo)),false);
});
