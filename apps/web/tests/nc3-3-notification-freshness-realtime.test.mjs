import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read=(path)=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const hook=read("../lib/use-notification-freshness.ts");
const workspace=read("../components/workspace-notification-bell.tsx");
const platform=read("../components/platform-notification-bell.tsx");
const workspaceLayout=read("../app/(workspace)/layout.tsx");
const platformLayout=read("../app/(platform)/platform/layout.tsx");
const workspacePage=read("../app/(workspace)/notifications/page.tsx");
const platformPage=read("../app/(platform)/platform/notifications/page.tsx");
const refresh=read("../components/notification-refresh-button.tsx");
const migration=read("../../../supabase/migrations/20261008140000_nc33_notification_realtime_publication.sql");
const dbTest=read("../../../supabase/tests/nc33_notification_realtime_publication.sql");
const workflow=read("../../../.github/workflows/p0-required-gate.yml");

test("NC3.3 Realtime publishes only RLS-protected recipient rows",()=>{
 assert.match(migration,/supabase_realtime/);
 assert.match(migration,/add table public\.workspace_notification_recipients/);
 assert.match(migration,/add table public\.platform_notification_recipients/);
 assert.doesNotMatch(migration,/add table public\.platform_notification_events/);
 assert.doesNotMatch(migration,/add table public\.workspace_notification_outbox/);
 assert.doesNotMatch(migration,/replica identity full/i);
 assert.doesNotMatch(migration,/grant select|grant insert|grant update/i);
 assert.match(dbTest,/both published recipient tables keep RLS/);
 assert.match(dbTest,/per-user SELECT RLS policies preserved/);
 assert.match(dbTest,/Realtime requires no new browser write permissions/);
 assert.match(dbTest,/event, source, outbox and bridge tables must never be broadcast/);
 assert.match(dbTest,/^begin;/m);
 assert.match(dbTest,/^rollback;/m);
 assert.match(workflow,/nc33_notification_realtime_publication\.sql/);
});

test("NC3.3 subscriptions are scoped by verified user, to original table only",()=>{
 assert.match(hook,/supabase\.auth\.getUser\(\)/);
 assert.match(hook,/scope === "platform"/);
 assert.match(hook,/platform_notification_recipients/);
 assert.match(hook,/workspace_notification_recipients/);
 assert.match(hook,/recipient_user_id=eq\.\$\{uid\}/);
 assert.match(hook,/postgres_changes/);
 assert.match(hook,/filter:/);
 assert.match(hook,/public/);
 assert.match(hook,/void loadVerifiedInbox\("change"\)/);
 assert.doesNotMatch(hook,/payload\.new|payload\.old|setSnapshot\(payload/);
 assert.doesNotMatch(hook,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("NC3.3 freshness falls back to bounded polling, disconnects on hidden/offline and auth changes",()=>{
 assert.match(hook,/NC33_POLL_MS = 90_000/);
 assert.match(hook,/NC33_STALE_MS = 180_000/);
 assert.match(hook,/MIN_REFRESH_MS = 10_000/);
 assert.match(hook,/setInterval/);
 assert.match(hook,/document\.visibilityState === "visible"/);
 assert.match(hook,/navigator\.onLine/);
 assert.match(hook,/dropRealtime\(\)/);
 assert.match(hook,/visibilitychange/);
 assert.match(hook,/online/);
 assert.match(hook,/offline/);
 assert.match(hook,/SIGNED_OUT/);
 assert.match(hook,/TOKEN_REFRESHED/);
 assert.match(hook,/supabase\.removeChannel\(channel\)/);
 assert.match(hook,/clearInterval\(pollId\)/);
 assert.match(hook,/clearTimeout\(pendingRefresh\)/);
});

test("NC3.3 never claims a successful refresh on failed RPC",()=>{
 assert.match(hook,/response\.error \? null/);
 assert.match(hook,/if \(!parsed\)/);
 assert.match(hook,/setSnapshot\(null\)/);
 assert.match(hook,/setVerifiedAt\(null\)/);
 assert.match(hook,/setVerifiedAt\(observed\)/);
 assert.match(hook,/router\.refresh\(\)/);
 assert.match(workspaceLayout,/notificationVerifiedAt = notificationSnapshot \? new Date\(\)\.toISOString\(\)/);
 assert.match(platformLayout,/notificationVerifiedAt = notificationSnapshot \? new Date\(\)\.toISOString\(\)/);
 assert.match(workspace,/stale/);
 assert.match(platform,/stale/);
 assert.match(workspace,/Dati verificati alle/);
 assert.match(platform,/Dati verificati alle/);
 assert.match(workspace,/onClick=\{refresh\}/);
 assert.match(platform,/onClick=\{refresh\}/);
});

test("NC3.3 both in-app centers expose explicit authenticated refresh",()=>{
 assert.match(workspacePage,/NotificationRefreshButton/);
 assert.match(platformPage,/NotificationRefreshButton/);
 assert.match(refresh,/router\.refresh\(\)/);
 assert.match(refresh,/disabled=\{pending\}/);
 assert.doesNotMatch(hook,/net\.http_post|sendEmail|sendPush/);
});
