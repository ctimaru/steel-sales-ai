import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../../supabase/migrations/20261020201000_netdata1eu_trader1d_review_readiness.sql",import.meta.url),"utf8");

test("TRADER1D requires independent, human-attributed review of each company dimension",()=>{
  for(const d of ["legal_identity","trader_role","product_evidence",
    "domain_reconciliation","reuse_rights","facility_source"])assert.ok(sql.includes("'"+d+"'"),d);
  assert.match(sql,/reviewer_id uuid NOT NULL REFERENCES auth\.users\(id\)/);
  assert.match(sql,/trader1d_accepted_requires_source/);
  assert.match(sql,/trader1d_identity_requires_evidence/);
  assert.match(sql,/trader1d_rights_require_permission/);
  assert.match(sql,/permission_basis IN \('written_permission','written_license','open_license'\)/);
  assert.match(sql,/rights_scope IN \('network_profile','network_facility'\)/);
});
test("TRADER1D append-only private queue excludes browser, never publishes or guesses geodata",()=>{
  assert.match(sql,/private\.netdata1eu_trader_review_decisions ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON private\.netdata1eu_trader_review_decisions\s+FROM public,anon,authenticated/);
  assert.match(sql,/GRANT SELECT,INSERT ON private\.netdata1eu_trader_review_decisions TO service_role/);
  assert.match(sql,/CREATE TRIGGER trader_review_append_only/);
  assert.match(sql,/RAISE EXCEPTION 'Trader review history is append-only'/);
  assert.match(sql,/LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''/);
  assert.match(sql,/current_user <> 'service_role'/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION private\.netdata1eu_trader_review_queue/);
  assert.doesNotMatch(sql,/GRANT UPDATE|GRANT DELETE|SECURITY DEFINER|INSERT INTO public\.network_companies|INSERT INTO public\.network_facilities|UPDATE public\.network_companies|eu_nuts2024_code/i);
});
test("TRADER1D evidence readiness remains blocked until legal identity, rights and all reviews",()=>{
  for(const field of ["identity_decision='accepted'","role_decision='accepted'",
    "product_decision='accepted'","domain_decision='accepted'",
    "rights_decision='accepted'","source_rights='license_approved'",
    "legal_name IS NOT NULL","legal_country_code IS NOT NULL",
    "legal_identity_evidence_url IS NOT NULL","research_state='ready_for_review'"]){
    assert.ok(sql.includes(field),field);
  }
  assert.match(sql,/editorial_evidence_ready/);
  assert.match(sql,/published_by_trader1d',0/);
  for(const flag of ["legal_identity_review","source_reuse_rights_review",
    "shared_domain_identity_hold","explicit_research_hold"])
    assert.ok(sql.includes("'"+flag+"'"),flag);
  assert.match(sql,/p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25/);
  assert.match(sql,/p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 10000/);
});
