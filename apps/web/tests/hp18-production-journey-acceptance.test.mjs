import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const registerActions = read("../app/register/actions.ts");
const registrationMigration = read(
  "../../../supabase/migrations/20261002093505_hp18_registration_dml_grants.sql",
);
const acceptanceSql = read(
  "../../../supabase/tests/hp18_production_journey_acceptance.sql",
);

test("HP18 registration UI has the DML grants required by its real PostgREST write path", () => {
  assert.match(registerActions, /\.from\("company_registration_applications"\)/);
  assert.match(registerActions, /\.insert\(payload\)/);
  assert.match(registerActions, /\.update\(payload\)/);
  assert.match(
    registrationMigration,
    /grant insert, update[\s\S]*company_registration_applications[\s\S]*authenticated/i,
  );
});

test("HP18 composes registration, activation/claim, setup and team into one acceptance transaction", () => {
  for (const contract of [
    "p0a_submit_registration_application",
    "p0a_approve_registration_application",
    "p0a_activate_registration_application",
    "hp5_company_claim_experience",
    "update_organization_onboarding",
    "hp7_company_setup_state",
    "hp8_claim_organization_invitation",
    "hp8_team_state",
  ]) {
    assert.ok(acceptanceSql.includes(contract), `missing journey contract: ${contract}`);
  }
});

test("HP18 composes the buyer and supplier Marketplace journey in the same transaction", () => {
  for (const contract of [
    "p5_1_create_request",
    "p5_1_add_request_line",
    "p5_1_publish_request",
    "p5_3_grant_entitlement",
    "p5_3_marketplace_detail",
    "p5_4_create_response",
    "p5_4_submit_response",
    "p5_4_buyer_inbox",
    "p5_4_buyer_response_detail",
    "p5_4_buyer_transition",
  ]) {
    assert.ok(acceptanceSql.includes(contract), `missing Marketplace contract: ${contract}`);
  }
  assert.match(acceptanceSql, /visibility_mode'[\s\S]*='anonymous'/);
  assert.match(acceptanceSql, /HP18 private buyer note[\s\S]*\)=0/);
  assert.match(
    acceptanceSql,
    /array\['created','submitted','acknowledged','closed'\]::text\[\]/,
  );
});

test("HP18 remains disposable and cannot leave synthetic production-like data", () => {
  assert.match(acceptanceSql, /^begin;/m);
  assert.match(acceptanceSql, /rollback;\s*$/);
  assert.match(acceptanceSql, /hp18_result/);
  assert.match(acceptanceSql, /'status','passed'/);
});
