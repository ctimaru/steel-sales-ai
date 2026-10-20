import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../../../supabase/migrations/20261020160500_netdata1eu_trader1b_firstparty_pilot.sql",import.meta.url),"utf8");
test("TRADER1B first five are internal research with explicit official-source provenance",()=>{
  for(const host of ["buhlmann-group.com","mcb.eu","distribution.arcelormittal.com","wuppermann.com","kovintrade.com"]){
    assert.ok(source.includes(host));
  }
  assert.match(source,/netdata1eu-trader1b-firstparty-20261020/);
  assert.match(source,/source_observed/);
  assert.match(source,/not_assessed/);
  assert.match(source,/research_only/);
  assert.match(source,/ON CONFLICT DO NOTHING/);
  assert.doesNotMatch(source,/INSERT INTO public\.network_companies|INSERT INTO public\.network_facilities|UPDATE public\.network_companies/);
});
test("TRADER1B no guessed NUTS or unsourced distribution locations",()=>{
 assert.doesNotMatch(source,/eu_nuts2024_code|INSERT INTO public\.network_eu_nuts2024_regions/);
 assert.match(source,/Bremen.*warehouse/);
 assert.match(source,/Duisburg.*warehouse/);
 assert.match(source,/Leverkusen.*office/);
 assert.match(source,/Celje.*facility_unspecified/);
});
