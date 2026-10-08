import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read=(p)=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const qa=read("../../../supabase/tests/nc51_notification_security_acceptance.sql");
const gate=read("../../../.github/workflows/p0-required-gate.yml");
const wsRoute=read("../app/(workspace)/notifications/open/[id]/route.ts");
const plRoute=read("../app/(platform)/platform/notifications/open/[id]/route.ts");
const wsPage=read("../app/(workspace)/notifications/page.tsx");
const plPage=read("../app/(platform)/platform/notifications/page.tsx");
const wsBell=read("../components/workspace-notification-bell.tsx");
const plBell=read("../components/platform-notification-bell.tsx");
const freshness=read("../lib/use-notification-freshness.ts");

test("NC5.1 uses rollback-only cross-context simulation with real SQL RLS",()=>{
 assert.match(qa,/^begin;/m);
 assert.match(qa,/^rollback;/m);
 assert.match(qa,/insert into public\.organizations/);
 assert.match(qa,/insert into public\.platform_staff_roles/);
 assert.match(qa,/insert into public\.workspace_notification_events/);
 assert.match(qa,/insert into public\.platform_notification_events/);
 assert.match(qa,/set local role authenticated/);
 assert.match(qa,/nc51_denied/);
 assert.match(qa,/tenant A sees only own Workspace notification/);
 assert.match(qa,/Platform reviewer sees own governance event/);
 assert.match(qa,/Role revocation must immediately deny/);
 assert.match(qa,/Organizational revocation must equally deny/);
 assert.match(gate,/nc23_source_bridges\.sql/);
 assert.match(gate,/nc31_workspace_notification_center\.sql/);
 assert.match(gate,/nc32_platform_governance_inbox\.sql/);
 assert.match(gate,/nc33_notification_realtime_publication\.sql/);
 assert.match(gate,/nc51_notification_security_acceptance\.sql/);
});

test("NC5.1 deep-links fail closed and redirect through current server authorization",()=>{
 assert.match(wsRoute,/getWorkspaceContext\(\)/);
 assert.match(wsRoute,/nc31_workspace_notification_destination/);
 assert.match(wsRoute,/UUID\.test/);
 assert.match(plRoute,/requirePlatformConsoleContext\(\)/);
 assert.match(plRoute,/nc32_platform_notification_destination/);
 assert.match(plRoute,/UUID\.test/);
 assert.doesNotMatch(wsRoute,/url\.searchParams|window\.location|p_href/);
 assert.doesNotMatch(plRoute,/url\.searchParams|window\.location|p_href/);
});

test("NC5.1 protects unresolved or stale inboxes from appearing empty",()=>{
 assert.match(wsPage,/!snapshot \?/);
 assert.match(plPage,/!snapshot \?/);
 assert.match(wsBell,/const unavailable = !demoMode && stale/);
 assert.match(plBell,/const unavailable = platformReady && stale/);
 assert.match(wsBell,/verifica non disponibile/);
 assert.match(plBell,/verifica non disponibile/);
 assert.match(freshness,/setSnapshot\(null\)/);
 assert.match(freshness,/NC33_POLL_MS = 90_000/);
 assert.match(freshness,/NC33_STALE_MS = 180_000/);
 assert.match(freshness,/document\.visibilityState === "visible"/);
 assert.match(freshness,/supabase\.auth\.getUser\(\)/);
 assert.doesNotMatch(freshness,/setSnapshot\(payload/);
});

test("NC5.1 does not add an unreviewed delivery channel",()=>{
 for(const source of [wsPage,plPage,wsBell,plBell,freshness]){
   assert.doesNotMatch(source,/service_role|RESEND_API_KEY|SMTP_PASSWORD/);
   assert.doesNotMatch(source,/http_post|sendPush\(|sendEmail\(/);
 }
});
