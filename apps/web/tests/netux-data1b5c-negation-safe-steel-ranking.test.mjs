import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../../supabase/migrations/20261020161530_netux_data1b5c_negation_safe_steel_ranking.sql",import.meta.url),"utf8");

test("DATA1B.5C: never turn narrative denials into positive tube evidence",()=>{
 assert.doesNotMatch(sql,/concat_ws\(' ',e\.field_value::text,e\.evidence_excerpt\) ~\*/);
 assert.match(sql,/when e\.field_value::text ~\*/);
 assert.match(sql,/machines are NOT tube jobshops|Machine producers are NOT tube jobshops/);
 assert.match(sql,/e\.field_key='products'/);
 assert.match(sql,/when ev\.priority=1 and ev\.field_key='services'/);
 assert.match(sql,/'score_version','deterministic-steel-tier-v2'/);
});
test("DATA1B.5C: preserve tenant access, identity guard, client response and bounded pagination",()=>{
 assert.match(sql,/private\.netux11_require_active_company\(p_organization_id\)/);
 assert.match(sql,/private\.pa1_3_require_network_access\(p_organization_id\)/);
 assert.match(sql,/b\.domain_uses=1/);
 assert.match(sql,/p_limit>18/);
 assert.match(sql,/limit p_limit offset p_offset/);
 assert.match(sql,/'contract','netdata1b4-steel-ranking-v1'/);
 assert.match(sql,/candidate_not_verified',true/);
 assert.match(sql,/revoke all on function public\.netdata1b4_steel_relevance_page/);
 assert.match(sql,/to authenticated/);
});
