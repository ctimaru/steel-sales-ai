import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseItalianCompanyCsv } from "../lib/italian-company-bulk-csv.mjs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("CRAWL-IT6.6c CSV: societary fiscal identifier is not VAT, allows no fictitious province", () => {
  const csv = "company_name,corporate_tax_id,role,source_record_id,evidence_url\n" +
    "CARPENTERIA ALFA SRL,01234567890,end_user,RNA-112-NACE-25.11,https://www.rna.gov.it/open-data/aiuti\n" +
    "CARPENTERIA ALFA SRL,01234567890,end_user,RNA-113-NACE-25.11,https://www.rna.gov.it/open-data/aiuti";
  const result = parseItalianCompanyCsv(csv,{defaultRole:"trader_distributor"});
  assert.equal(result.originalRows,2);
  assert.equal(result.rows.length,1);
  assert.equal(result.duplicatesInFile,1);
  assert.equal(result.rows[0].corporate_tax_id,"01234567890");
  assert.equal(result.rows[0].vat_id,"");
  assert.equal(result.rows[0].province,"");
  assert.equal(result.rows[0].role,"end_user");
  assert.equal(result.rows[0].source_record_id,"RNA-112-NACE-25.11");
});

test("CRAWL-IT6.6c CSV rejects natural person CF and contact columns", () => {
  assert.throws(()=>
    parseItalianCompanyCsv("company_name,corporate_tax_id\nSiderurgia Alfa SRL,RSSMRA80A01H501U",{
      defaultRole:"end_user"
    }),/Codice fiscale societario non valido/);
  assert.throws(()=>
    parseItalianCompanyCsv("company_name,corporate_tax_id,telefono\nSiderurgia Alfa SRL,01234567890,12345",{
      defaultRole:"end_user"
    }),/colonne personali/);
});

test("CRAWL-IT6.6c read-only GitHub preview cannot stage, publish or access Supabase secret", () => {
  const workflow=read("../../../.github/workflows/crawl-it66c-rna-corporate-preview.yml");
  const sql=read("../../../supabase/migrations/20261014190000_crawl_it66c_rna_corporate_tax_source.sql");
  const page=read("../app/(italian)/(platform)/platform/company-discovery/bulk-import/page.tsx");
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/max_candidates:/);
  assert.match(workflow,/retention-days: 3/);
  assert.doesNotMatch(workflow,/schedule:|\bpush:|secrets\.|CRAWL_IT65B_SUPABASE_SECRET_KEY/);
  assert.match(sql,/governance_status='approved'/);
  assert.match(sql,/alter table public\.network_bulk_intake_rows/);
  assert.match(sql,/corporate_tax_id/);
  assert.match(sql,/where not exists/);
  assert.doesNotMatch(sql,/insert into public\.network_companies|update public\.network_companies/i);
  assert.match(page,/Registro Nazionale Aiuti di Stato/);
  assert.match(page,/candidati open data/);
});
