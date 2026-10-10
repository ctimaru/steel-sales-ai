import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read=(p)=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const ia=read("../lib/platform-ia-contract.ts");
const nav=read("../components/platform-navigation.tsx");
const shell=read("../components/platform-shell.tsx");
const bell=read("../components/platform-notification-bell.tsx");
const home=read("../app/(platform)/platform/page.tsx");
const lab=read("../app/(platform)/platform/novita/page.tsx");
const labDetail=read("../app/(platform)/platform/novita/listini/[versionId]/page.tsx");
const sql=read("../../../supabase/migrations/20261010150000_plr2_private_lab_owner_boundary.sql");
const dismiss=read("../components/header-menu-dismiss-controller.tsx");

test("PLR2 sidebar and mobile menu use single PLR1 six-area permission contract",()=>{
  assert.match(nav,/getPlatformIaVisibleModules/);
  assert.match(nav,/PLATFORM_IA_AREAS\.map/);
  assert.match(nav,/item\.placement !== "utility"/);
  assert.match(nav,/aria-current=\{selected \? "page"/);
  assert.match(nav,/aria-label=\{mobile \? "Navigazione mobile Platform"/);
  assert.match(nav,/aria-label="Apri navigazione Platform"/);
  assert.match(nav,/max-h-\[calc\(100dvh/);
  assert.match(nav,/min-h-11/);
  assert.match(nav,/usePathname/);
  assert.match(shell,/<PlatformLocation \/>/);
  assert.match(ia,/key: "privateLab"[\s\S]*?access: \{ kind: "owner_only" \}[\s\S]*?rollout: "ready_for_plr2"/);
});
test("PLR2 preserves context switch, mobile menu dismissal and staff-safe bell",()=>{
  assert.match(shell,/ContextSwitchLink/);
  assert.match(shell,/label="Torna al workspace aziendale"/);
  assert.match(shell,/label="Workspace aziendale"/);
  assert.match(shell,/isPlatformOwner \? \(/);
  assert.match(shell,/HeaderMenuDismissController/);
  assert.match(dismiss,/header details\[open\]/);
  assert.match(dismiss,/menu\.open = false/);
  assert.match(dismiss,/event\.key === "Escape"/);
  assert.match(shell,/canReadRegistrations=\{permissions\.includes\("registrations\.read"\)\}/);
  assert.match(bell,/canReadRegistrations \? \(/);
});
test("PLR2 Private Lab protected at route and SQL callable RPC boundaries",()=>{
  assert.match(lab,/await requirePlatformSuperadmin\(\);\s*const lists/);
  assert.match(labDetail,/await requirePlatformSuperadmin\(\);\s*const \{ versionId \}/);
  assert.match(home,/context\.is_platform_owner \? \([\s\S]*?href="\/platform\/novita"/);
  const functions=sql.split(/create or replace function public\.pl1_private_lab_explorer_/i).slice(1);
  assert.equal(functions.length,2);
  for(const f of functions) {
    assert.match(f,/private\.is_platform_superadmin\(\)/);
    assert.match(f,/security definer set search_path = ''/);
    assert.match(f,/errcode='42501'/);
    assert.doesNotMatch(f,/has_platform_permission\('platform\.console\.access'\)/);
  }
  assert.match(sql,/revoke all on function public\.pl1_private_lab_explorer_items\(uuid\) from public, anon, authenticated/);
  assert.match(sql,/grant execute on function public\.pl1_private_lab_explorer_items\(uuid\) to authenticated/);
});
test("PLR2 does not replace live notification, registration, or owner authority rules",()=>{
  assert.match(home,/getRegistrationQueue\(\)/);
  assert.match(home,/needsAttention/);
  assert.match(shell,/PlatformNotificationBell/);
  assert.match(ia,/staffTenantDataAccess: false/);
  assert.match(nav,/getPlatformIaVisibleModules/);
  assert.doesNotMatch(nav,/staffEnabled/);
  assert.doesNotMatch(nav,/href: "\/platform\/audit"/);
});
