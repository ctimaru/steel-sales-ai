import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20261004060000_pa1_5_public_company_data_governance.sql",
    import.meta.url,
  ),
  "utf8",
);
const governancePage = fs.readFileSync(
  new URL(
    "../app/(platform)/platform/company-discovery/governance/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const discoveryPage = fs.readFileSync(
  new URL("../app/(platform)/platform/company-discovery/page.tsx", import.meta.url),
  "utf8",
);
const discoveryActions = fs.readFileSync(
  new URL("../app/(platform)/platform/company-discovery/actions.ts", import.meta.url),
  "utf8",
);
const publicPage = fs.readFileSync(
  new URL("../app/(public)/company-data/page.tsx", import.meta.url),
  "utf8",
);
const publicActions = fs.readFileSync(
  new URL("../app/(public)/company-data/actions.ts", import.meta.url),
  "utf8",
);
const lookup = fs.readFileSync(
  new URL("../components/public-company-lookup.tsx", import.meta.url),
  "utf8",
);
const accessContract = fs.readFileSync(
  new URL("../lib/platform-access-contract.ts", import.meta.url),
  "utf8",
);

test("PA1.5 adds a fail-closed source and candidate governance gate", () => {
  assert.match(migration, /pa1_5_discovery_publication_guard/);
  assert.match(migration, /governance_status<>'approved'/);
  assert.match(migration, /terms_status not in \('allows_reuse','allows_limited_reuse'\)/);
  assert.match(migration, /database_rights_status not in \('low_risk','licensed'\)/);
  assert.match(migration, /new\.governance_status<>'approved_company_data'/);
  assert.match(migration, /new\.personal_data_detected/);
  assert.match(migration, /PA1\.5 governance gate blocks publication\/enrichment/);
});

test("PA1.5 governance authority is root-only and separate from normal discovery operations", () => {
  assert.match(accessContract, /key: "discovery\.governance_review"/);
  assert.match(accessContract, /"discovery\.governance_review",[\s\S]*"tenant_access\.break_glass"/);
  assert.doesNotMatch(
    accessContract.match(/key: "network_operations_admin"[\s\S]*?\n  },/)?.[0] ?? "",
    /discovery\.governance_review/,
  );
  assert.match(governancePage, /decisione riservata al Platform Owner/);
  assert.match(discoveryActions, /requirePlatformPermission\("discovery\.governance_review"\)/);
});

test("PA1.5 keeps ordinary discovery review usable but hides materialization until governance-ready", () => {
  assert.match(discoveryPage, /governanceState\?\.publication_gate_ready/);
  assert.match(discoveryPage, /Completa gate PA1\.5/);
  assert.match(discoveryPage, /href="\/platform\/company-discovery\/governance"/);
  assert.match(governancePage, /Source gate/);
  assert.match(governancePage, /Candidate gate/);
});

test("PA1.5 creates a minimal public correction/removal channel without exposing its queue", () => {
  assert.match(publicPage, /Dati aziendali, fonti e correzioni/);
  assert.match(publicPage, /Il Network[\s\S]*non è una directory pubblica/);
  assert.match(publicActions, /pa1_5_submit_company_data_request/);
  assert.match(migration, /company_data_governance_requests enable row level security/);
  assert.match(migration, /revoke all on table public\.company_data_governance_requests from public,anon,authenticated/);
  assert.match(migration, /too many company-data requests from this email/);
  assert.match(lookup, /href="\/company-data"/);
});

test("PA1.5 explicitly preserves the private Network and company-data-only default", () => {
  assert.match(migration, /'network_public',false/);
  assert.match(migration, /'exclude_personal_employee_contacts_by_default'/);
  assert.match(migration, /'commercial_memory_never_feeds_public_company_data'/);
  assert.match(governancePage, /Il Network rimane privato e premium/);
});
