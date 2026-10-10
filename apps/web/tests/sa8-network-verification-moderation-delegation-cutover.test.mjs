import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const platformIa = fs.readFileSync(new URL("../lib/platform-ia-contract.ts", import.meta.url), "utf8");

const contract = fs.readFileSync(
  new URL("../lib/platform-access-contract.ts", import.meta.url),
  "utf8",
);
const navigation = fs.readFileSync(
  new URL("../components/platform-navigation.tsx", import.meta.url),
  "utf8",
);
const home = fs.readFileSync(
  new URL("../app/(platform)/platform/page.tsx", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(platform)/platform/network-trust/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(platform)/platform/network-trust/actions.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20260928213000_sa8_network_verification_moderation_delegation_cutover.sql",
    import.meta.url,
  ),
  "utf8",
);

test("SA8 adds a distinct Network Trust role and capability family", () => {
  assert.match(contract, /"network_trust_admin"/);
  assert.match(contract, /label: "Network Trust Admin"/);
  assert.match(contract, /Claims & Ownership Admin/);

  for (const permission of [
    "network_trust.read",
    "network_trust.assert",
    "network_trust.verify",
    "network_trust.revoke",
    "network_trust.review_changes",
    "network_trust.identity_refresh",
    "network_trust.identity_review",
  ]) {
    assert.match(
      contract,
      new RegExp(permission.replaceAll(".", "\\.")),
    );
    assert.match(
      migration,
      new RegExp(permission.replaceAll(".", "\\.")),
    );
  }
});

test("SA8 exposes Network Trust only through network_trust.read", () => {
  assert.match(
    platformIa,
    /key: "networkTrust"[\s\S]*?access: \{ kind: "permission", key: "network_trust\\.read" \}/,
  );
  assert.match(home, /canReadNetworkTrust/);
  assert.match(
    home,
    /context\.permissions\.includes\("network_trust\.read"\)/,
  );
  assert.match(home, /getNetworkTrustQueue/);
  assert.match(page, /requirePlatformPermission\("network_trust\.read"\)/);
});

test("SA8 UI gates every privileged Network Trust operation independently", () => {
  for (const permission of [
    "network_trust.assert",
    "network_trust.verify",
    "network_trust.revoke",
    "network_trust.review_changes",
    "network_trust.identity_refresh",
    "network_trust.identity_review",
  ]) {
    assert.match(
      page,
      new RegExp(
        "permissions\\.includes\\([\\s\\S]*?\"" +
          permission.replaceAll(".", "\\.") +
          "\"[\\s\\S]*?\\)",
      ),
    );
  }
  assert.match(page, /Confermare un match[\s\S]*?nessun merge/i);
  assert.match(page, /Commercial Memory/i);
});

test("SA8 Server Actions recheck exact capabilities", () => {
  assert.match(
    actions,
    /createNetworkTrustAssertion[\s\S]*?requirePlatformPermission\("network_trust\.assert"\)/,
  );
  assert.match(
    actions,
    /recordNetworkVerification[\s\S]*?network_trust\.revoke[\s\S]*?network_trust\.verify/,
  );
  assert.match(
    actions,
    /openNetworkChangeReview[\s\S]*?requirePlatformPermission\("network_trust\.review_changes"\)/,
  );
  assert.match(
    actions,
    /decideNetworkChangeReview[\s\S]*?requirePlatformPermission\("network_trust\.review_changes"\)/,
  );
  assert.match(
    actions,
    /refreshNetworkIdentityCandidates[\s\S]*?requirePlatformPermission\("network_trust\.identity_refresh"\)/,
  );
  assert.match(
    actions,
    /reviewNetworkIdentityCandidate[\s\S]*?requirePlatformPermission\("network_trust\.identity_review"\)/,
  );
});

test("SA8 cuts M4/M5 root-only operations over to explicit capabilities", () => {
  for (const permission of [
    "network_trust.assert",
    "network_trust.verify",
    "network_trust.revoke",
    "network_trust.review_changes",
    "network_trust.identity_refresh",
    "network_trust.identity_review",
  ]) {
    assert.match(
      migration,
      new RegExp(
        "require_platform_permission\\('" +
          permission.replaceAll(".", "\\.") +
          "'\\)",
      ),
    );
  }

  assert.match(migration, /accepted evidence assertion required/);
  assert.match(migration, /automatic_merge_performed',false/);
  assert.match(migration, /merge_performed',false/);
  assert.match(migration, /automatic_overwrite_performed',false/);
});

test("SA8 keeps root governance and tenant-private access outside Network Trust", () => {
  assert.doesNotMatch(
    migration,
    /\('network_trust_admin','platform\.staff\.(invite|manage_roles|suspend)'/,
  );
  assert.doesNotMatch(
    migration,
    /\('network_trust_admin','tenant_access\.break_glass'/,
  );
  assert.match(
    migration,
    /role_key='network_trust_admin'[\s\S]*?p\.is_root_only/,
  );
  assert.doesNotMatch(actions, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("SA8 audits all delegated Trust mutations", () => {
  for (const action of [
    "network_assertion_created",
    "network_verification_verified",
    "network_verification_revoked",
    "network_change_review_opened",
    "network_change_review_accepted",
    "network_identity_candidates_refreshed",
    "network_identity_match_confirmed",
  ]) {
    assert.match(migration, new RegExp(action));
  }
});
