import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const platformIa = fs.readFileSync(new URL("../lib/platform-ia-contract.ts", import.meta.url), "utf8");

const navigation = fs.readFileSync(
  new URL("../components/platform-navigation.tsx", import.meta.url),
  "utf8",
);
const home = fs.readFileSync(
  new URL("../app/(platform)/platform/page.tsx", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(platform)/platform/company-claims/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(platform)/platform/company-claims/actions.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20260928193000_sa6_claims_verification_delegation_cutover.sql",
    import.meta.url,
  ),
  "utf8",
);

test("SA6 exposes Company Claims to authorized Platform Staff", () => {
  assert.match(
    platformIa,
    /key: "claims"[\s\S]*?access: \{ kind: "permission", key: "claims\.read" \}/,
  );
  assert.match(home, /canReadClaims/);
  assert.match(home, /context\.permissions\.includes\("claims\.read"\)/);
  const cockpit = fs.readFileSync(new URL("../lib/platform-cockpit.ts", import.meta.url), "utf8");
  assert.match(cockpit, /p3_6_admin_claim_queue/);
  assert.match(home, /Company Claims/);
});

test("SA6 cuts the Company Claims route over to claims.read", () => {
  assert.match(page, /requirePlatformPermission\("claims\.read"\)/);
  assert.match(page, /getPlatformAccessContext/);
  assert.doesNotMatch(page, /requirePlatformSuperadmin/);
});

test("SA6 renders proof and claim decisions from dedicated capabilities", () => {
  for (const permission of [
    "claims.review_proof",
    "claims.approve",
    "claims.reject",
    "claims.revoke",
  ]) {
    assert.match(
      page,
      new RegExp(
        "permissions\\.includes\\(\"" +
          permission.replaceAll(".", "\\.") +
          "\"\\)",
      ),
    );
  }

  assert.match(page, /canReviewProof/);
  assert.match(page, /canApprove/);
  assert.match(page, /canReject/);
  assert.match(page, /canRevoke/);
  assert.match(page, /Accesso in sola lettura/);
});

test("SA6 server actions recheck exact claim capabilities", () => {
  assert.match(
    actions,
    /reviewCompanyClaimProof[\s\S]*?requirePlatformPermission\("claims\.review_proof"\)/,
  );
  assert.match(
    actions,
    /decision === "under_review"[\s\S]*?"claims\.review_proof"/,
  );
  assert.match(
    actions,
    /decision === "approved"[\s\S]*?"claims\.approve"/,
  );
  assert.match(
    actions,
    /decision === "rejected"[\s\S]*?"claims\.reject"/,
  );
  assert.match(actions, /"claims\.revoke"/);
  assert.doesNotMatch(actions, /requirePlatformContext/);
});

test("SA6 database cutover replaces root gates only for Claims operations", () => {
  for (const permission of [
    "claims.read",
    "claims.review_proof",
    "claims.approve",
    "claims.reject",
    "claims.revoke",
  ]) {
    assert.match(
      migration,
      new RegExp(
        "require_platform_permission\\([^)]*" +
          permission.replaceAll(".", "\\.") ,
      ),
    );
  }

  assert.match(migration, /sa6_record_claim_action/);
  assert.match(migration, /company_claim_proof_verified/);
  assert.match(migration, /company_claim_approved/);
  assert.match(migration, /company_claim_rejected/);
  assert.match(migration, /company_claim_revoked/);
  assert.doesNotMatch(
    migration,
    /create or replace function private\.m4_record_verification_impl/,
  );
});

test("SA6 preserves claim proof gating and claim-verification separation", () => {
  assert.match(
    migration,
    /p_decision='approved'[\s\S]*?v_claim\.proof_status<>'verified'/,
  );
  assert.match(
    migration,
    /verified ownership proof required before claim approval/,
  );
  assert.match(migration, /verification_status/);
  assert.match(
    migration,
    /SA6 does not delegate this state machine to Claims & Verification Admin/,
  );
});
