import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../../supabase/migrations/20261020161500_netdata1eu_trader1c1_source_research.sql",import.meta.url),"utf8");
const domains=["ferona.cz","weyland.at","begroup.com","stalprofil.com.pl","rff.de","kloeckner.com","lemu.dk","damstahl.com","arabesque.ro","heitonsteel.ie","fleischmann.stappert.biz","mairon.ro","tibnor.se","stenastal.se","hierrosgil.com"];
test("TRADER1C.1 first-party 15 research domains with rights and identity holds",()=>{
 assert.equal(domains.length,15);assert.equal(new Set(domains).size,15);
 for(const d of domains)assert.ok(sql.includes("'"+d+"'"),d);
 for(const phrase of ["not_assessed","research_only","identity_hold","source_observed","ON CONFLICT DO NOTHING"])assert.ok(sql.includes(phrase));
});
test("TRADER1C.1 cannot publish, geocode or grant public permissions",()=>{
 assert.doesNotMatch(sql,/INSERT INTO public\.(network_companies|network_facilities)|UPDATE public\.network_companies|eu_nuts2024_code|GRANT .*authenticated/i);
 for(const city of ["Prague","Malmö","Dąbrowa Górnicza","Kolding","Skanderborg","Brașov","Dublin","Teesdorf","Göteborg"])assert.ok(sql.includes(city));
});
