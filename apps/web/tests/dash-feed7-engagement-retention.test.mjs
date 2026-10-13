import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../../../supabase/migrations/20261013134500_dash_feed7_engagement_retention.sql");
const hp = read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");
const page = read("../app/(italian)/(platform)/platform/feed-insights/page.tsx");
const product = read("../app/(italian)/(platform)/platform/product-analytics/page.tsx");
const server = read("../lib/dashboard-feed7-server.ts");
const model = read("../lib/dashboard-feed7-model.ts");
const browser = read("demotest23-chrome-auth.mjs");
const exports = {};
vm.runInNewContext(ts.transpileModule(model, {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText, {exports, Date, Number, Set, Object, Array, Intl, Math});
const {parseDashFeed7Snapshot, assessDashFeed7} = exports;
const events = ["news_source","interests","network_profiles","opportunities"];
const emptyActions = {news_source:0,interests:0,network_profiles:0,opportunities:0};
const days = (count) => Array.from({length:count},(_,i)=>({
  day:new Date(Date.UTC(2026,8,14+i)).toISOString().slice(0,10),
  home_views:i===count-1?112:0, active_users:i===count-1?1:0,
  ...emptyActions,
}));
const payload = (count=30)=>({
  contract:"DASH-FEED7-v1",window_days:count,as_of_day:"2026-10-13",
  first_observed_home_day:"2026-10-07",
  home_views:112,unique_home_users:1,returning_home_users:1,
  observed_home_days:1, actions:{...emptyActions},
  d1:{eligible:1,returned:1,rate_percent:null},
  d7:{eligible:0,returned:0,rate_percent:null},
  daily:days(count),
});

test("DASH-FEED7 distinguishes one returning account from many Home events",()=>{
  const item=parseDashFeed7Snapshot(payload(),30);
  assert.ok(item);
  assert.equal(item.home_views,112);
  assert.equal(item.unique_home_users,1);
  assert.equal(assessDashFeed7(item).state,"insufficient_sample");
  assert.equal(item.d1.rate_percent,null);
});

test("DASH-FEED7 never accepts small-cohort rates or malformed totals",()=>{
  const bad=payload();bad.d1.rate_percent=100;
  assert.equal(parseDashFeed7Snapshot(bad,30),null);
  const double=payload();double.unique_home_users=150;
  assert.equal(parseDashFeed7Snapshot(double,30),null);
  const corrupted=payload();corrupted.actions.opportunities=3;
  assert.equal(parseDashFeed7Snapshot(corrupted,30),null);
  assert.equal(parseDashFeed7Snapshot({...payload(), daily:[]},30),null);
  assert.equal(parseDashFeed7Snapshot(payload(),7),null);
});

test("DASH-FEED7 readiness separates no data, missing clicks, immature cohorts and ready states",()=>{
  const one=parseDashFeed7Snapshot(payload(),30);
  assert.ok(one);
  const zero={...one,home_views:0};
  assert.equal(assessDashFeed7(zero).state,"no_data");
  const enough={...one,unique_home_users:22,returning_home_users:5};
  assert.equal(assessDashFeed7(enough).state,"awaiting_actions");
  const click={...enough,actions:{...emptyActions,news_source:4}};
  assert.equal(assessDashFeed7(click).state,"cohort_maturing");
  const ready={...click,d1:{eligible:15,returned:7,rate_percent:46.7},d7:{eligible:12,returned:4,rate_percent:33.3}};
  assert.equal(assessDashFeed7(ready).state,"exploratory");
});

test("DASH-FEED7 SQL is strictly owner-only, aggregate and cohort-safe",()=>{
  assert.match(sql,/private\.is_platform_superadmin\(\)/);
  assert.match(sql,/platform superadmin required/);
  assert.match(sql,/security definer/);
  assert.match(sql,/set search_path=''/);
  assert.match(sql,/grant execute on function public\.dash_feed7_platform_insights\(integer\) to authenticated/);
  assert.match(sql,/revoke all on function public\.dash_feed7_platform_insights/);
  assert.match(sql,/c\.d1_eligible>=10/);
  assert.match(sql,/c\.d7_eligible>=10/);
  assert.match(sql,/first_home/);
  assert.match(sql,/first_day\+1/);
  assert.match(sql,/first_day\+7/);
  assert.match(sql,/group by actor_user_id/);
  assert.doesNotMatch(sql, /'actor_user_id'\\s*,\\s*e\\./i);
  assert.match(hp,/dash_feed7_platform_insights/);
  assert.match(hp,/not has_function_privilege\('anon'/);
  assert.match(hp,/platform superadmin required/);
});

test("DASH-FEED7 superadmin page is isolated and degrades honestly",()=>{
  assert.match(page,/await requirePlatformSuperadmin\(\)/);
  assert.match(page,/getDashFeed7Insights\(days\)/);
  assert.match(page,/D\+1 e D\+7/);
  assert.match(page,/Campione insufficiente/);
  assert.match(page,/Dati engagement non disponibili/);
  assert.match(page,/non giorno di registrazione/);
  assert.match(page,/sm:grid-cols-2/);
  assert.match(page,/overflow-x-auto/);
  assert.match(product,/appRoutes\.platform\.feedInsights/);
  assert.match(server,/createClient\(\)/);
  assert.match(server,/dash_feed7_platform_insights/);
  assert.doesNotMatch(server,/service_role|organization_memberships|select\(/);
  assert.match(browser,/DASH-FEED7 platform engagement denied/);
});
