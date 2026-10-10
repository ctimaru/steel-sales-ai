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
  new URL("../app/(platform)/platform/company-discovery/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(platform)/platform/company-discovery/actions.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20260928184500_sa5_network_operations_delegation_cutover.sql",
    import.meta.url,
  ),
  "utf8",
);

test("SA5 exposes Company Discovery to authorized Platform Staff", () => {
  assert.match(
    platformIa,
    /key: "discovery"[\s\S]*?access: \{ kind: "permission", key: "discovery\\.read" \}/,
  );
  assert.match(home, /canReadDiscovery/);
  assert.match(home, /context\.permissions\.includes\("discovery\.read"\)/);
  assert.match(home, /Company Discovery/);
});

test("SA5 cuts the Company Discovery route over to discovery.read", () => {
  assert.match(page, /requirePlatformPermission\("discovery\.read"\)/);
  assert.doesNotMatch(page, /requirePlatformSuperadmin/);
  assert.match(page, /getPlatformAccessContext/);
});

test("SA5 keeps Platform Staff separate from tenant Network navigation", () => {
  assert.match(page, /access\?\.is_platform_owner \?/);
  assert.match(page, /href="\/network"/);
  assert.match(page, /Apri Network/);
});

test("SA5 renders discovery operations from their dedicated capabilities", () => {
  for (const permission of [
    "discovery.run",
    "discovery.review",
    "discovery.publish",
    "discovery.enrich",
    "discovery.close_duplicates",
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

  assert.match(page, /canRun \?/);
  assert.match(page, /canPublish/);
  assert.match(page, /canEnrich/);
  assert.match(page, /canCloseDuplicates/);
  assert.match(page, /Accesso in sola lettura/);
});

test("SA5 server actions recheck Company Discovery capabilities", () => {
  assert.match(
    actions,
    /startCompanyDiscovery[\s\S]*?requirePlatformPermission\("discovery\.run"\)/,
  );
  assert.match(
    actions,
    /reviewCompanyDiscovery[\s\S]*?requirePlatformPermission\("discovery\.review"\)/,
  );
  assert.match(
    actions,
    /decision === "publish_new"[\s\S]*?requirePlatformPermission\("discovery\.publish"\)/,
  );
  assert.match(
    actions,
    /decision === "enrich_existing"[\s\S]*?requirePlatformPermission\("discovery\.enrich"\)/,
  );
  assert.match(
    actions,
    /closeExactDiscoveryDuplicates[\s\S]*?requirePlatformPermission\("discovery\.close_duplicates"\)/,
  );
  assert.doesNotMatch(actions, /requirePlatformContext/);
});

test("SA5 database cutover removes direct root gates and enforces explicit permissions", () => {
  for (const permission of [
    "discovery.read",
    "discovery.run",
    "discovery.review",
    "discovery.publish",
    "discovery.enrich",
    "discovery.close_duplicates",
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

  assert.match(migration, /sa5_record_discovery_action/);
  assert.match(migration, /discovery_candidate_published/);
  assert.match(migration, /discovery_candidate_enriched/);
  assert.match(migration, /discovery_exact_duplicates_closed/);
  assert.match(migration, /SA5 Company Discovery cutover left/);
});

test("SA5 publication and enrichment remain higher-risk decisions layered over review", () => {
  assert.match(
    migration,
    /require_platform_permission\('discovery\.review'\)[\s\S]*?p_decision='publish_new'[\s\S]*?require_platform_permission\('discovery\.publish'\)/,
  );
  assert.ok(
    (
      migration.match(
        /require_platform_permission\('discovery\.enrich'\)/g,
      ) ?? []
    ).length >= 2,
  );
});
