import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const pulse = read("../components/dashboard-steel-pulse.tsx");
const discovery = read("../components/dashboard-discovery-feed.tsx");
const tracked = read("../components/dashboard-tracked-link.tsx");
const actions = read("../app/(workspace)/telemetry/actions.ts");
const migration = read("../../../supabase/migrations/20261013113154_dash_feed6_engagement_events.sql");
const report = read("../../../supabase/analytics/dash_feed6_engagement_report.sql");
const chrome = read("demotest23-chrome-auth.mjs");
const dashboard = read("../app/(workspace)/dashboard/page.tsx");

const eventNames = [
  "dashboard_news_source_opened",
  "dashboard_interest_settings_opened",
  "dashboard_network_profile_opened",
  "dashboard_marketplace_teaser_opened",
];

test("DASH-FEED6 emits only explicit whitelisted navigation events, no private per-item ids", () => {
  for (const name of eventNames) {
    assert.match(actions, new RegExp(name));
    assert.match(migration, new RegExp(name));
    assert.match(tracked, new RegExp(name));
  }
  assert.match(tracked, /recordPilotUsageEvent/);
  assert.match(tracked, /event\.defaultPrevented/);
  assert.match(tracked, /event\.ctrlKey/);
  assert.match(tracked, /metadata: \{ source: "dashboard_feed", surface: "dashboard" \}/);
  assert.doesNotMatch(tracked, /entityId|source_url|request_id|buyerId|buyer_id|buyer\.|organizationId|localStorage|sessionStorage|navigator\.sendBeacon/);
  assert.doesNotMatch(tracked, /preventDefault\(/);
});

test("DASH-FEED6 builds keyboard-accessible native disclosure without content loss", () => {
  assert.match(pulse, /cards\.slice\(0, 2\)\.map/);
  assert.match(pulse, /cards\.slice\(2\)\.map/);
  assert.match(pulse, /<details className="group/);
  assert.match(pulse, /<summary className=/);
  assert.match(pulse, /min-h-12 cursor-pointer/);
  assert.match(pulse, /href="#dashboard-discovery"/);
  assert.match(pulse, /engagementKind="interests"/);
  assert.match(pulse, /engagementKind="news_source"/);
  assert.match(pulse, /rel="noopener noreferrer"/);
  assert.doesNotMatch(pulse, /dangerouslySetInnerHTML/);
});

test("DASH-FEED6 tracks governed link intent without changing privacy/entitlement", () => {
  assert.match(discovery, /engagementKind="network_profile"/);
  assert.match(discovery, /engagementKind="marketplace_teaser"/);
  assert.match(discovery, /appRoutes\.network\.company\(item\.companyId\)/);
  assert.match(discovery, /appRoutes\.marketplace\.opportunity\(item\.id\)/);
  assert.match(discovery, /networkEntitled \? selectDashboardFollowedUpdates\(activity\) : \[\]/);
  assert.match(dashboard, /getMarketplaceFeed\(context\.organizationId, \{ limit: 10, offset: 0 \}\)/);
  assert.doesNotMatch(discovery + tracked, /buyer\.display_name|inquiry\.body|service_role/);
});

test("DASH-FEED6 SQL preserves tenant membership, event whitelist and metadata scrubbing", () => {
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /public\.is_organization_member\(p_organization_id,true\)/);
  assert.match(migration, /security definer set search_path=''/);
  assert.match(migration, /jsonb_strip_nulls\(jsonb_build_object/);
  assert.match(migration, /'source',p_metadata->>'source'/);
  assert.match(migration, /'surface',p_metadata->>'surface'/);
  assert.match(migration, /'format',p_metadata->>'format'/);
  assert.doesNotMatch(migration, /grant (all|execute|select) .* to anon|insert into auth\.users|create policy/i);
});

test("DASH-FEED6 metrics are read-only and explicitly separated from claimed conversion", () => {
  assert.match(report, /workspace_home_viewed/);
  for (const name of eventNames) assert.match(report, new RegExp(name));
  assert.doesNotMatch(report, /actor_user_id|organization_id|insert|update|delete|create table/i);
  assert.match(report, /30 days/);
});

test("DASH-FEED6 Chrome acceptance covers each tenant, 320px mobile and navigation access", () => {
  assert.match(chrome, /DASH-FEED6 discovery and role-safe navigation/);
  assert.match(chrome, /DASH-FEED6 Chrome 320px mobile disclosure and discovery jump/);
  assert.match(chrome, /size\.scroll <= size\.client \+ 12/);
  assert.match(chrome, /other\.rfqTitle/);
  assert.match(chrome, /Vai alle opportunità/);
});
