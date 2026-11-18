import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=readFileSync(new URL(
  "../../../supabase/migrations/20261118160000_net_pro_producers_b3c2_verified_upload_intake.sql",
  import.meta.url,
),"utf8");
const page=read("app/(italian)/(workspace)/network/manage/cataloghi/page.tsx");
const component=read("components/producer-catalogue-upload.tsx");
const manage=read("app/(italian)/(workspace)/network/manage/page.tsx");

test("B3.C2 creates a private pending-provenance intake, never an automatic licence",()=>{
  assert.match(sql,/create table private\.network_producer_catalog_submissions/);
  assert.match(sql,/state text not null default 'awaiting_upload'/);
  assert.match(sql,/pending_provenance/);
  assert.match(sql,/rights_declared_at timestamptz/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on private\.network_producer_catalog_submissions/);
  assert.doesNotMatch(sql,/grant execute on function private\.netproducers1_b3c2_catalog_submission\(text,jsonb\)/);
  assert.doesNotMatch(sql,/insert into private\.network_producer_catalog_grants/i);
  assert.doesNotMatch(sql,/netproducers1_b3c_catalog_queue\('enqueue'/);
  assert.doesNotMatch(sql,/grant execute on function public\.netproducers1_b2_catalog\(text,jsonb\)\s+to authenticated/);
});

test("B3.C2 permission checks approved and independently verified company identity",()=>{
  for(const term of [
    "auth.uid()", "network_company_claims", "cl.status='approved'",
    "cl.proof_status='verified'", "cl.revoked_at is null",
    "m.user_id=(select auth.uid())", "m.role='admin'",
    "m.status='active'", "r.canonical_key='producer'", "r.status='active'",
    "c.publication_status='published'", "country_code='IT'",
  ]) assert.ok(sql.includes(term),term);
  assert.match(sql,/create policy netproducers1_b3c2_verified_company_catalog_insert/);
  assert.match(sql,/on storage\.objects for insert to authenticated/);
  assert.match(sql,/bucket_id='producer-authorized-catalogs'/);
  assert.match(sql,/private\.netproducers1_b3c2_can_insert_object\(name\)/);
  assert.doesNotMatch(sql,/on storage\.objects for select to authenticated/);
  assert.doesNotMatch(sql,/on storage\.objects for update to authenticated/);
});

test("B3.C2 binds immutable bytes to company, document and source",()=>{
  assert.match(sql,/company_id::text\|\|'\/'\|\|catalog_id::text\|\|'\/'/);
  assert.match(sql,/document_sha256\|\|'\.'\|\|document_format/);
  assert.match(sql,/upload_deadline>now\(\)/);
  assert.match(sql,/o\.name=v_entry\.object_path/);
  assert.match(sql,/o\.created_at>=v_entry\.created_at/);
  assert.match(sql,/rights_declaration/);
  assert.match(sql,/split_part\(v_url,'\/',3\)/);
  assert.match(sql,/split_part\(v_url,'\/',3\)/);
  assert.match(sql,/Daily secure-upload quota reached/);
  assert.match(sql,/private\.netproducers1_b2_catalog\('revoke'/);
});

test("B3.C2 exposes a single accessible page without leaking service credentials",()=>{
  assert.match(page,/requireWorkspaceAdmin/);
  assert.match(page,/getManagedNetworkCompany/);
  assert.match(page,/ProducerCatalogueUpload/);
  assert.match(manage,/href="\/network\/manage\/cataloghi"/);
  assert.match(component,/createClient/);
  assert.match(component,/crypto\.subtle\.digest\("SHA-256"/);
  assert.match(component,/upsert:false/);
  assert.match(component,/rights_declaration:true/);
  assert.match(component,/p_operation:"finalize"/);
  assert.match(component,/p_operation:"withdraw"/);
  assert.match(component,/rights_verified!==false/);
  assert.match(component,/published_claims!==0/);
  assert.match(component,/sm:grid-cols-2/);
  assert.doesNotMatch(page+component,/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|service_role/);
});

test("B3.C2 refuses to present uploaded files as verified manufacturer SKUs",()=>{
  assert.match(component,/In attesa della verifica automatica/);
  assert.match(component,/Fonte verificata · analisi tecnica in coda/);
  assert.match(component,/Documento o autorizzazione da chiarire/);
  assert.match(page,/Nessun dato equivale automaticamente alla disponibilità/);
  assert.match(component,/Verifica aziendale necessaria/);
  assert.match(component,/Revoca/);
});
