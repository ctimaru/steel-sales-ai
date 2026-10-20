import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const migration=readFileSync(new URL("../../../supabase/migrations/20261020162000_netdata1eu_trader1c2_source_research.sql",import.meta.url),"utf8");
const domains=["stad.fr","ltbfrance.com","deneuve.fr","salzgitter-mannesmann-stahlhandel.de","heitmann-stahl.de","polska.ims-group.com","thyssenkrupp-materials.pl","drozapol.pl","koenigstahl.pl","cooprabuis.nl","thyssenkrupp-materials.nl","teham-pongers.nl","psi-steel.nl","leontubos.com","marcelianomartin.com","globalmetal.es","eduardocortina.com","valsteel.pt","abcsteel.cz","impextb.cz","weylandstahlhandel.cz","koenigfrankstahl.cz","ferrum-mb.cz","h-metal.ro","steel-tubes.ro"];
const markets=["FR","FR","FR","DE","DE","PL","PL","PL","PL","NL","NL","NL","NL","ES","ES","ES","ES","PT","CZ","CZ","CZ","CZ","CZ","RO","RO"];
test("TRADER1C.2 contains 25 unique source-observed EU trader research domains",()=>{
 assert.equal(domains.length,25);
 assert.equal(new Set(domains).size,25);
 for(const d of domains)assert.ok(migration.includes("'"+d+"'"),d);
 for(const country of ["FR","DE","PL","NL","ES","PT","CZ","RO"])assert.ok(markets.includes(country),country);
 assert.match(migration,/netdata1eu-trader1c2-firstparty-20261020/);
 assert.match(migration,/ON CONFLICT DO NOTHING/);
});
test("TRADER1C.2 is not licensed publication, public geo backfill or private user outreach",()=>{
 assert.match(migration,/not_assessed/);
 assert.match(migration,/research_only/);
 assert.match(migration,/source_observed/);
 assert.doesNotMatch(migration,/INSERT INTO public\.(network_companies|network_facilities)|UPDATE public\.network_companies|eu_nuts2024_code|GRANT .*authenticated|INSERT INTO public\.rfq/i);
});
test("TRADER1C.2 10 private source-observed places, never guessed NUTS codes",()=>{
 for(const city of ["Avrigny","Rijswijk","Mysłowice","Warszawa","Erandio","Vila Nova de Gaia","Plchovice","Praha-Modletice","Moravské Budějovice","București"])assert.ok(migration.includes(city),city);
 assert.match(migration,/warehouse/);
 assert.match(migration,/office/);
});
