import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("app/(italian)/(workspace)/network/cataloghi/page.tsx");
const ownerPage=read("app/(italian)/(workspace)/network/manage/cataloghi/page.tsx");
const user=read("components/producer-pdf-size-tables.tsx");
const owner=read("components/producer-pdf-size-owner.tsx");
const parser=read("lib/network-producer-pdf-dimensions.ts");
const worker=readFileSync(new URL("../../../services/worker/app/net_pro_producers_pdf_table_sizes_c3.py",import.meta.url),"utf8");
const sql=readFileSync(new URL("../../../supabase/migrations/20261118193000_net_producers_c3_pdf_real_size_rows.sql",import.meta.url),"utf8");
const sec=readFileSync(new URL("../../../supabase/tests/sec1_public_rpc_boundary.sql",import.meta.url),"utf8");

test("PDF-derived sizes are buyer-visible first, the original link only provides optional evidence",()=>{
 assert.match(page,/ProducerPdfSizeTables data=\{pdfSizes\}/);
 assert.ok(page.indexOf("<ProducerPdfSizeTables")<page.indexOf("<ProducerStructuredCatalogue"));
 assert.match(user,/Cataloghi PDF convertiti in dati/);
 assert.match(user,/Misure tecniche disponibili nel Network/);
 assert.match(user,/data-testid="pdf-size-producer-card"/);
 assert.match(user,/Da confermare dal produttore/);
 assert.match(user,/Da verificare/);
 assert.match(user,/details className=/);
 assert.match(user,/target="_blank" rel="noopener noreferrer"/);
 assert.match(user,/xl:grid-cols-2/);
 assert.match(user,/nessuna conferma automatica/i);
});

test("source evidence is bounded to page, official domain and producer owner veto",()=>{
 for(const needle of [
  "private.network_producer_pdf_size_rows","unique(company_id,source_url,locator)",
  "netproducers_c3_pdf_events_append_only","l.document_type='official_pdf'",
  "l.rights_status='link_only'","to service_role",
  "netproducers_c3_pdf_stage","source_url","line_sha256",
  "netproducers1_b3c2_is_authorized_company_admin",
  "owner_review<>'removed'","verified_manufacturer_skus',0",
  "mirrored_pdf_copies',0","'official_pdf_text_index'",
 ]){
  assert.ok(sql.includes(needle),needle);
 }
 assert.doesNotMatch(sql,/grant execute on function public\.netproducers_c3_pdf_stage\(uuid,text,jsonb\)\s+to anon/);
 assert.match(sql,/source_row_sha256|line_sha256/);
 assert.match(sec,/netproducers_c3_pdf_public_impl/);
 assert.match(sec,/v_published_facades<>14/);
 assert.match(sec,/v_internals<>15/);
});

test("PDF rows are never promoted to graded, exact manufactured SKUs by metadata alone",()=>{
 assert.match(parser,/r\.verified_manufacturer_skus!==0/);
 assert.match(parser,/r\.mirrored_pdf_copies!==0/);
 assert.match(parser,/x\.thickness_mm!==null/);
 assert.match(worker,/no steel grade/i);
 assert.match(worker,/thickness values/i);
 assert.match(worker,/same.page|SAME page/i);
 assert.match(sql,/thickness_mm numeric/);
 assert.match(sql,/v_item->>'thickness_mm' is not null/);
});

test("verified producer can confirm remove restore individual PDF rows",()=>{
 assert.match(ownerPage,/ProducerPdfSizeOwner companyId=/);
 assert.match(owner,/netproducers_c3_pdf_owner/);
 assert.match(owner,/p_company:companyId/);
 for(const value of ['"confirm"','"remove"','"restore"'])
  assert.ok(owner.includes(value),value);
 assert.match(owner,/rimozione prevale su qualsiasi successiva scansione automatica/);
 assert.doesNotMatch(owner,/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/);
});
