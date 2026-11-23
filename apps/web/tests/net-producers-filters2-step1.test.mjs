import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

// NET-PRODUCERS-FILTERS2 · passo 1 (founder approval, 23 Nov 2026).
const sql=readFileSync(new URL("../../../supabase/migrations/20261123190000_net_producers_filters2_step1_removals_pdf_rows.sql",import.meta.url),"utf8");

test("FILTERS2.1 producer moderation wins in filters and in list rows",()=>{
  const rule=/not exists \(\s*select 1 from private\.network_producer_structured_facts s\s*where s\.source_claim_id=e\.id\s*and \(s\.producer_review='removed' or s\.visibility='withdrawn'\)/g;
  assert.equal((sql.match(rule)||[]).length,2,"evidence for filters AND netproducers1_technical_claims_impl");
  assert.match(sql,/create or replace function private\.netproducers1_technical_claims_impl\(/);
  assert.match(sql,/private\.netpro1b_allowed_for\(p_organization_id,'producers','IT'\)/);
});

test("FILTERS2.1 PDF table rows feed filters, never the unspecified standard or removed rows",()=>{
  assert.match(sql,/from private\.network_producer_pdf_size_rows r/);
  assert.match(sql,/r\.owner_review<>'removed' and r\.standard<>'CATALOGUE_UNSPECIFIED'/);
  assert.match(sql,/case r\.shape when 'CHS' then 'Tondo' when 'SHS' then 'Quadro' when 'RHS' then 'Rettangolare' end/);
});

test("FILTERS2.1 section synonyms are one value; helper stays closed; read-only",()=>{
  assert.match(sql,/when t in \('rhs','rettangolare'/);
  assert.match(sql,/revoke all on function private\.netproducers2_evidence_impl\(text\) from public,anon,authenticated;/);
  assert.doesNotMatch(sql,/grant execute on function private\.netproducers2_evidence_impl/);
  assert.doesNotMatch(sql,/\b(insert into|update [a-z_.]+ set|delete from)\b/i);
  assert.doesNotMatch(sql,/service_role/);
});
