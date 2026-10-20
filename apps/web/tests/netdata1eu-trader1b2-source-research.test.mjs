import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../../supabase/migrations/20261020161000_netdata1eu_trader1b2_source_research.sql",import.meta.url),"utf8");
test("TRADER1B.2 adds 15 domain-distinct official research records and no publication",()=>{
 const domains=["hoberg-driesch.com","spaeter.de","thyssenkrupp-schulte.de","kdi.fr","pouchard.fr","sopromet.fr","vanleeuwen.com","solines.nl","bowim.pl","konsorcjumstali.pl","hierrosmoraanton.com","tubosparis.es","ehg-stahl.com","metalunion.be","claessens-wettstein.be"];
 assert.equal(domains.length,15);
 assert.equal(new Set(domains).size,15);
 for(const domain of domains)assert.ok(sql.includes("'"+domain+"'"));
 assert.match(sql,/netdata1eu-trader1b-firstparty-20261020/);
 assert.match(sql,/ON CONFLICT DO NOTHING/);
 assert.doesNotMatch(sql,/INSERT INTO public\.network_companies|INSERT INTO public\.network_facilities|UPDATE public\.network_companies|UPDATE public\.network_facilities/);
});
test("TRADER1B.2 keeps rights unknown, Van Leeuwen duplicate on identity hold, no NUTS",()=>{
 assert.match(sql,/identity_hold/);
 assert.match(sql,/Van Leeuwen Italia S\.p\.A\./);
 assert.match(sql,/not_assessed/);
 assert.match(sql,/source_observed/);
 assert.match(sql,/research_only/);
 assert.doesNotMatch(sql,/eu_nuts2024_code|INSERT INTO public\.network_eu_nuts2024_regions|frankstahl\.com/);
});
test("TRADER1B.2 six privately sourced facilities, no guessed warehouses",()=>{
 for(const city of ["Mitry-Mory","Aubervilliers","Moerdijk","Kraków","Brugge","Dornbirn"])assert.ok(sql.includes(city));
 assert.match(sql,/facility_unspecified/);
 assert.match(sql,/pouchard\.fr.*warehouse/);
});
