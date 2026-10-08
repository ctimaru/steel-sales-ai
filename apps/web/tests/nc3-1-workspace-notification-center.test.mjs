import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(p,import.meta.url),"utf8");
const migration = read("../../../supabase/migrations/20261008121000_nc31_workspace_notification_rpc.sql");
const resolver = read("../../../supabase/migrations/20261008121100_nc31_workspace_notification_destination.sql");
const sqlTest = read("../../../supabase/tests/nc31_workspace_notification_center.sql");
const page = read("../app/(workspace)/notifications/page.tsx");
const route = read("../app/(workspace)/notifications/open/[id]/route.ts");
const actions = read("../app/(workspace)/notifications/actions.ts");
const lib = read("../lib/workspace-notifications.ts");
const layout = read("../app/(workspace)/layout.tsx");
const shell = read("../components/app-shell.tsx");
const bell = read("../components/workspace-notification-bell.tsx");
const paths = read("../lib/routes.ts");
const workflow = read("../../../.github/workflows/p0-required-gate.yml");

test("NC3.1: Workspace bell uses per-user RPC and never disguises failure as empty", () => {
  assert.match(layout, /nc31_workspace_notifications_read/);
  assert.match(layout, /p_organization_id: context.organizationId/);
  assert.match(layout, /notificationSnapshot = error \? null/);
  assert.match(shell, /WorkspaceNotificationBell/);
  assert.match(bell, /Notifiche: verifica non disponibile/);
  assert.match(bell, /router\.refresh\(\)/);
  assert.match(bell, /role="dialog"/);
  assert.match(bell, /Escape/);
  assert.match(bell, /onClick=\{\(\) => setOpen\(false\)\}/);
  assert.match(paths, /notifications: "\/notifications"/);
  assert.doesNotMatch(shell, /WorkspaceAlertsButton/);
});

test("NC3.1: Inbox filters, pagination and individual lifecycle are visibly wired", () => {
  for (const f of ["all","unread","commercial","system","archived"]) {
    assert.match(page,new RegExp('id: "'+f+'"'));
    assert.match(migration,new RegExp("'"+f+"'"));
  }
  assert.match(page, /Centro notifiche/);
  assert.match(page, /Impossibile verificare le notifiche/);
  assert.match(page, /Operazione non valida/);
  assert.match(page, /revalidate|setWorkspaceNotificationState/);
  assert.match(page, /snapshot\.filteredCount/);
  assert.match(page, /page\+1/);
  assert.match(page, /Apri attività/);
  assert.match(page, /Registro alert/);
  assert.match(actions, /nc31_workspace_notification_set_state/);
  assert.match(actions, /p_organization_id: context.organizationId/);
  assert.match(actions, /revalidatePath/);
  assert.match(actions, /redirect\(returnTo\)/);
});

test("NC3.1: RPCs enforce tenant and exact own-recipient ACL at database boundary", () => {
  assert.match(migration,/security invoker/);
  assert.match(migration,/security definer/);
  assert.match(migration,/set search_path\\s*=\\s*''/);
  assert.match(migration,/public\.is_organization_member\(p_organization_id,false\)/);
  assert.match(migration,/r\.recipient_user_id=v_actor/);
  assert.match(migration,/r\.recipient_user_id=v_user/);
  assert.match(migration,/from public,anon,authenticated/);
  assert.match(migration,/to authenticated/);
  assert.match(migration,/coalesce\(read_at,now\(\)\)/);
  assert.match(migration,/archived_at=null/);
  assert.doesNotMatch(migration,/grant update on public\.workspace_notification_recipients/i);
});

test("NC3.1: destinations are not derived from client-supplied URLs", () => {
  assert.match(route, /nc31_workspace_notification_destination/);
  assert.match(route, /getWorkspaceContext/);
  assert.match(route, /p_organization_id: context.organizationId/);
  assert.match(route, /UUID\.test/);
  assert.match(route, /appRoutes\.marketplace\.rfqCampaign/);
  assert.match(route, /appRoutes\.marketplace\.opportunity/);
  assert.match(resolver, /security definer/);
  assert.match(resolver, /r\.recipient_user_id=v_actor/);
  assert.match(resolver, /t\.status='active'/);
  assert.match(resolver, /m\.status='active'/);
  assert.match(resolver, /public\.marketplace_unlocks/);
  assert.match(resolver, /'unavailable'/);
  assert.doesNotMatch(resolver, /p_url|p_href/);
  assert.match(lib, /PRESENTATION/);
  assert.match(lib, /Fail closed/);
  assert.match(lib, /definition\.scope !== "workspace"/);
});

test("NC3.1: regression SQL rejects cross-tenant, colleague and suspended access", () => {
  assert.match(sqlTest,/^begin;/m);
  assert.match(sqlTest,/^rollback;/m);
  assert.match(sqlTest,/same tenant colleague does not see first user private receipts/);
  assert.match(sqlTest,/commercial filter isolates RFQ/);
  assert.match(sqlTest,/system filter isolates failed import/);
  assert.match(sqlTest,/source resolver validates real job/);
  assert.match(sqlTest,/nc31_denied/);
  assert.match(sqlTest,/status='suspended'/);
  assert.match(workflow,/nc31_workspace_notification_center\.sql/);
});
