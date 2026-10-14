import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseItalianCompanyCsv} from "../lib/italian-company-bulk-csv.mjs";
const read = path => readFileSync(new URL(path,import.meta.url),"utf8");

test("CRAWL-IT6.6b CSV: semicolon, ATECO version, Italian header, quoted company, two segments",()=>{
 const csv='Denominazione;Sito web;Provincia;Codice ATECO;source_record_id\n"Acciai, Tubazioni S.r.l.";https://www.tubi65.example/;MI;46.82.10;id1\n"Carpenteria; Meccanica SPA";https://buyer65.example;TO;25.11;id2';
 const r=parseItalianCompanyCsv(csv,{defaultRole:"end_user",atecoVersion:"2025"});
 assert.equal(r.rows.length,2);
 assert.equal(r.rows[0].company_name,"Acciai, Tubazioni S.r.l.");
 assert.equal(r.rows[0].domain,"tubi65.example");
 assert.equal(r.rows[0].ateco_code,"46.82.10");
 assert.equal(r.rows[0].ateco_version,"2025");
 assert.equal(r.rows[0].role,"end_user");
 assert.equal(r.rows[1].company_name,"Carpenteria; Meccanica SPA");
});

test("CRAWL-IT6.6b CSV: BOM, escaped quotes, repeated domain dedup and strict identity",()=>{
 const csv='\uFEFFcompany_name,domain,province\n"Ferro ""Milano"" SRL",same66.example,MI\nFerro Milano SPA,https://same66.example/,MI';
 const r=parseItalianCompanyCsv(csv,{defaultRole:"trader_distributor"});
 assert.equal(r.originalRows,2);
 assert.equal(r.rows.length,1);
 assert.equal(r.duplicatesInFile,1);
 assert.equal(r.rows[0].company_name,'Ferro "Milano" SRL');
 assert.equal(r.rows[0].source_record_id,"csv-line-2");
});

test("CRAWL-IT6.6b CSV: denies individual contacts, unsupported segments, ambiguous ATECO",()=>{
 assert.throws(()=>parseItalianCompanyCsv("company_name,email,province\nTest Ferro SRL,test@example.test,MI",{defaultRole:"end_user"}),/colonne personali/i);
 assert.throws(()=>parseItalianCompanyCsv("company_name,domain,role\nFoo Steel SRL,foo66.example,superadmin",{defaultRole:"end_user"}),/Segmento non valido/);
 assert.throws(()=>parseItalianCompanyCsv("company_name,domain,ateco_code\nSteel Milano SRL,steel66.example,46.82.10",{defaultRole:"trader_distributor"}),/ATECO richiede/);
 assert.throws(()=>parseItalianCompanyCsv("company_name,domain\nSteel Milano SRL,http://localhost",{defaultRole:"trader_distributor"}),/Sito web non valido|valido/i);
 assert.throws(()=>parseItalianCompanyCsv("company_name\nSteel Milano SRL",{defaultRole:"end_user"}),/Servono almeno/i);
});

test("CRAWL-IT6.6a/b: private platform route, official source proposed only, no cron or auto-publication",()=>{
 const sql=read("../../../supabase/migrations/20261014183000_crawl_it66ab_bulk_corporate_intake.sql");
 const route=read("../app/api/platform/company-discovery/bulk-intake/route.ts");
 const page=read("../app/(italian)/(platform)/platform/company-discovery/bulk-import/page.tsx");
 assert.match(sql,/network_bulk_intake_rows/);
 assert.match(sql,/private\.require_platform_permission\('discovery\.run'\)/);
 assert.match(sql,/governance_status='approved'/);
 assert.match(sql,/terms_status in \('allows_reuse','allows_limited_reuse'\)/);
 assert.match(sql,/source_url='https:\/\/query\.wikidata\.org\/sparql'/);
 assert.match(sql,/unique\(source_id,identity_key\)/);
 assert.match(sql,/role text not null check\(proposed_role in \('trader_distributor','end_user'\)\)/);
 assert.match(sql,/source_name,source_url,source_type,review_note/);
 assert.match(sql,/where not exists/);
 assert.match(sql,/security invoker set search_path=''/);
 assert.doesNotMatch(sql,/insert into public\.network_companies|update public\.network_companies/);
 assert.match(route,/requirePlatformPermission\("discovery\.run"\)/);
 assert.match(route,/new URL\(origin\)\.host !== host/);
 assert.match(route,/mode === "stage" && String\(data\.get\("preview_digest"\)/);
 assert.match(route,/MAX_BYTES = 768 \* 1024/);
 assert.match(route,/CHUNK = 200/);
 assert.match(route,/published: 0, role_verified: false/);
 assert.match(page,/role/i);
});
