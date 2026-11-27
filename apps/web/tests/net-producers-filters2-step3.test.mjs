import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

// NET-PRODUCERS-FILTERS2 · passo 3 (founder decisions 18 and 23 Nov 2026).
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261127180000_net_producers_filters2_step3_pdf_claims.sql");
const worker=read("../../../services/worker/app/net_pro_producers_pdf_claims_f2.py");
const cron=read("../../../services/worker/app/net_pro_producers_auto1.py");

test("F2 queue RPC is service-role only, never anon or authenticated",()=>{
  assert.match(sql,/revoke all on function public\.netproducers3_pdf_claims\(text,jsonb\) from public,anon,authenticated;/);
  assert.match(sql,/grant execute on function public\.netproducers3_pdf_claims\(text,jsonb\) to service_role;/);
  assert.doesNotMatch(sql,/grant execute[^;]*to (anon|authenticated)/i);
  assert.match(sql,/revoke all on private\.network_producer_pdf_claims_queue from public,anon,authenticated,service_role;/);
});

test("F2 only first-party official PDF links of published Italian producers",()=>{
  for(const token of [
    "l.document_type='official_pdf' and l.rights_status='link_only'",
    "l.source_status='official_link_observed'",
    "c.publication_status='published' and c.archived_at is null",
    "c.country_code='IT'",
    "r.canonical_key='producer' and r.status='active'",
    "regexp_replace(lower(c.website_domain),'^www[.]','')",
  ])assert.ok(sql.includes(token),token);
});

test("F2 review mode never publishes; stage needs a live publish lease and closed values",()=>{
  assert.match(sql,/q\.lease_token=v_token and q\.lease_until>now\(\) and q\.lease_mode='publish'/);
  assert.match(sql,/and not \(q\.lease_mode='review' and v_status='complete'\)/);
  assert.match(sql,/v_value not in \(\s*'Senza saldatura'/);
  assert.match(sql,/v_value not in \('Tondo','Quadro','Rettangolare','Ovale'\)/);
  assert.match(sql,/jsonb_array_length\(p_payload->'facts'\) not between 1 and 40/);
  assert.match(sql,/on conflict \(company_id,product_scope,claim_kind,claim_value,source_url\) do nothing/);
  assert.match(sql,/'first_party_observed','link_only'/);
  assert.doesNotMatch(sql,/manufacturer_confirmed\s*=\s*true|delete from/i);
});

test("F2 worker: closed vocabularies, no certifications, default OFF in the cron",()=>{
  assert.match(worker,/_NOT_PRODUCT_STANDARD/);
  assert.match(worker,/MAX_FACTS_PER_DOCUMENT = 40/);
  assert.match(worker,/if mode == "review":/);
  assert.match(cron,/os\.getenv\("NETPRODUCERS_F2_CLAIMS_MODE", ""\)/);
  assert.match(cron,/f2_mode in \("review", "publish"\)/);
});
