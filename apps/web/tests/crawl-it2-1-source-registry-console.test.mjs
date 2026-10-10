import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");

test("CRAWL-IT2.1 Platform source registry is permission scoped", () => {
  const page = read("app/(platform)/platform/company-discovery/sources/page.tsx");
  const actions = read("app/(platform)/platform/company-discovery/sources/actions.ts");
  assert.match(page, /requirePlatformPermission\("discovery\.read"\)/);
  assert.match(page, /discovery\.governance_review/);
  assert.match(actions, /requirePlatformPermission\("discovery\.governance_review"\)/);
  assert.match(actions, /p_enable: false/);
  assert.match(page, /La scansione rimane disabilitata/);
});

test("CRAWL-IT2.1 SQL RPCs defend permission, rights and cannot auto-enable from UI", () => {
  const sql = read("../../supabase/migrations/20261010213000_crawl_it2_source_registry_console_rpcs.sql");
  assert.match(sql, /private\.require_platform_permission\('discovery\.read'\)/);
  assert.match(sql, /private\.require_platform_permission\('discovery\.governance_review'\)/);
  assert.match(sql, /p_enable boolean default false/);
  assert.match(sql, /enabled_for_discovery=p_enable/);
  const schema = read("../../supabase/migrations/20261010211500_crawl_it2_approved_source_registry.sql");
  assert.match(schema, /enabled_for_discovery boolean not null default false/);
  assert.match(schema, /crawl_it2_source_not_enabled_without_governance/);
});
