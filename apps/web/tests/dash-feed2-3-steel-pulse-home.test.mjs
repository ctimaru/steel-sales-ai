import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const dashboard = read("../app/(workspace)/dashboard/page.tsx");
const reader = read("../lib/dashboard-pulse.ts");
const panel = read("../components/dashboard-steel-pulse.tsx");
const actions = read("../app/(workspace)/pulse/actions.ts");

function mockReader({ feedError = null, feedData = null, engagementError = null, engagementData = null, interestsError = null, interestsData = null, rejects = false } = {}) {
  const exports = {};
  const calls = [];
  const db = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (rejects) throw new Error("RPC unavailable");
      if (name === "sp5_my_steel_pulse_feed") return { data: feedData, error: feedError };
      if (name === "sp6_my_article_engagement") return { data: engagementData, error: engagementError };
      if (name === "sp8_my_feed_interests") return { data: interestsData, error: interestsError };
      throw new Error("Unexpected RPC: " + name);
    },
  };
  const compiled = ts.transpileModule(reader, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    Promise,
    require: (name) => {
      if (name === "server-only") return {};
      if (name === "@/lib/supabase/server") return { createClient: async () => db };
      if (name === "@/lib/steel-pulse-personalized") return {
        parsePulsePersonalizedFeed: (value) => value?.preferences && Array.isArray(value?.items) ? value : null,
      };
      if (name === "@/lib/steel-pulse-advanced") return {
        EMPTY_PULSE_ADVANCED_INTERESTS: { product_interests: [], territory_interests: [] },
        parsePulseAdvancedInterests: (value) =>
          Array.isArray(value?.product_interests) && Array.isArray(value?.territory_interests) ? value : null,
        rankPersonalizedPulseCards: (items) => [...items],
      };
      if (name === "@/lib/steel-pulse-engagement") return {
        parsePulseEngagement: (value) => Array.isArray(value?.saved_urls) && Array.isArray(value?.read_urls) ? value : null,
      };
      throw new Error("Unexpected import " + name);
    },
  });
  return { load: exports.loadDashboardPulse, calls };
}

test("DASH-FEED3 reads published, authenticated personal feed only; parallel, bounded", async () => {
  const feed = { preferences: { topics: [], language_code: "it", role_interest: "all" }, items: [] };
  const engagement = { saved_urls: [], read_urls: [], saved_items: [] };
  const { load, calls } = mockReader({ feedData: feed, engagementData: engagement });
  const data = await load();
  assert.equal(data.available, true);
  assert.equal(data.feed.items.length, 0);
  assert.deepEqual(calls.map((x) => x.name), [
    "sp5_my_steel_pulse_feed",
    "sp6_my_article_engagement",
    "sp8_my_feed_interests",
  ]);
  assert.deepEqual(calls.map((x) => x.args?.p_limit), [12, 12, undefined]);
  assert.doesNotMatch(reader, /service_role|organization_memberships|select\(/i);
});

test("DASH-FEED3 fails closed for unavailable or malformed news", async () => {
  const absent = await mockReader({ feedError: { message: "offline" } }).load();
  assert.equal(absent.available, false);
  assert.equal(absent.feed, null);
  const malformed = await mockReader({ feedData: ["unsafe"] }).load();
  assert.equal(malformed.available, false);
  const rejected = await mockReader({ rejects: true }).load();
  assert.equal(rejected.available, false);
});

test("DASH-FEED3 missing engagement never blocks permitted news", async () => {
  const feed = { preferences: { topics: [], language_code: "it", role_interest: "all" }, items: [] };
  const { load } = mockReader({ feedData: feed, engagementError: { message: "offline" } });
  const result = await load();
  assert.equal(result.available, true);
  assert.equal(result.engagement, null);
});

test("DASH-FEED3 Home uses governed cards; no invented content or dangerous render", () => {
  assert.match(dashboard, /loadDashboardPulse\(\)/);
  assert.match(dashboard, /<DashboardSteelPulse state=\{pulse\} \/>/);
  assert.match(panel, /state\.feed\?\.items \?\? \[\]/);
  assert.match(panel, /cards\.slice\(0, 2\)\.map/);
  assert.match(panel, /cards\.slice\(2\)\.map/);
  assert.match(panel, /card\.relevance/);
  assert.match(panel, /card\.source_url/);
  assert.match(panel, /rel="noopener noreferrer"/);
  assert.doesNotMatch(panel, /dangerouslySetInnerHTML|organizationId|service_role/);
});

test("DASH-FEED3 save/read actions return to allowlisted /dashboard only", () => {
  assert.match(panel, /name="return_to" value="dashboard"/);
  assert.match(panel, /<form action=\{setPulseArticleEngagement\}>/);
  assert.match(actions, /formData\.get\("return_to"\) === "dashboard"/);
  assert.match(actions, /returnToDashboard \? "\/dashboard"/);
  assert.match(actions, /if \(returnToDashboard\) revalidatePath\("\/dashboard"\)/);
  assert.match(actions, /validatePulseSourceUrl\(sourceUrl\)/);
  assert.match(actions, /validatePulseAction\(action\)/);
  assert.doesNotMatch(actions, /formData\.get\("redirect_url"\)|p_user_id|service_role/);
});

test("DASH-FEED2 hides informational Network updates from urgency while retaining access", () => {
  assert.match(dashboard, /attentionCount > 0/);
  assert.match(dashboard, /networkEntitled && \(received\.total > 0 \|\| activity\.unread > 0\)/);
  assert.match(dashboard, /appRoutes\.network\.activity/);
  assert.match(dashboard, /appRoutes\.network\.inquiries/);
  assert.match(dashboard, /canWrite && metrics\.reviewFlags > 0/);
});
