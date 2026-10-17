import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql=readFileSync(new URL("../../../supabase/migrations/20261017202000_neteima2b_source_url_regex_fix.sql",import.meta.url),"utf8");
test("NET-EIMA2B: fixed URL validation is bounded, rejects URL query/fragment and preserves first-party host",()=>{
  assert.match(sql,/\^https:\/\//);
  assert.match(sql,/\[a-z0-9\._~\/%-\]/);
  assert.doesNotMatch(sql,/\[\^\?\#\[\[:space:\]\]/);
  assert.match(sql,/v_host<>t\.canonical_domain/);
  assert.match(sql,/position\('@' in p_source_url\)/);
  assert.match(sql,/public\.network_it_municipalities/);
  assert.match(sql,/current_user<>'service_role'/);
  assert.match(sql,/on conflict\(target_id\) do nothing/);
  assert.doesNotMatch(sql,/insert into public\.network_companies|insert into public\.network_facilities/);
});