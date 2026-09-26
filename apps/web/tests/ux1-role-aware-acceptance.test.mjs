import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const policy = fs.readFileSync(new URL("../lib/access-policy.ts", import.meta.url), "utf8");
const context = fs.readFileSync(new URL("../lib/workspace-context.ts", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const platformLayout = fs.readFileSync(new URL("../app/(platform)/platform/layout.tsx", import.meta.url), "utf8");
const networkProfile = fs.readFileSync(new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url), "utf8");
const inquiries = fs.readFileSync(new URL("../app/(workspace)/network/inquiries/page.tsx", import.meta.url), "utf8");
const networkActions = fs.readFileSync(new URL("../app/(workspace)/network/actions.ts", import.meta.url), "utf8");
const uploadActions = fs.readFileSync(new URL("../app/(workspace)/uploads/actions.ts", import.meta.url), "utf8");
const bulkActions = fs.readFileSync(new URL("../app/(workspace)/uploads/bulk-actions.ts", import.meta.url), "utf8");
const reviewActions = fs.readFileSync(new URL("../app/(workspace)/review/actions.ts", import.meta.url), "utf8");
const dataSourceActions = fs.readFileSync(new URL("../app/(workspace)/data-sources/actions.ts", import.meta.url), "utf8");
const pilotActions = fs.readFileSync(new URL("../app/(workspace)/pilot-analytics/actions.ts", import.meta.url), "utf8");

const guardedLayouts = [
  "../app/(workspace)/operations/uploads/layout.tsx",
  "../app/(workspace)/operations/review/layout.tsx",
  "../app/(workspace)/company/profile/layout.tsx",
  "../app/(workspace)/company/data-sources/layout.tsx",
  "../app/(workspace)/company/pilot-analytics/layout.tsx",
  "../app/(workspace)/network/[id]/inquiry/layout.tsx",
].map((path) => fs.readFileSync(new URL(path, import.meta.url), "utf8"));

test("UX1.5 freezes the Organization role capability matrix", () => {
  assert.match(policy, /viewer: new Set\(\["commercial_read", "network_read"\]\)/);
  assert.match(policy, /member: new Set\(\[/);
  assert.match(policy, /"network_interact"/);
  assert.match(policy, /"commercial_write"/);
  assert.match(policy, /admin: new Set\(\[/);
  assert.match(policy, /"company_admin"/);
  assert.match(policy, /if \(capability === "platform_control"\) return false/);
});

test("UX1.5 server guards derive from the same central policy", () => {
  assert.match(context, /canWriteWorkspace\(context\.role\)/);
  assert.match(context, /canAdministerCompany\(context\.role\)/);
  assert.match(shell, /canWriteWorkspace\(role\)/);
  assert.match(shell, /canAdministerCompany\(role\)/);
});

test("UX1.5 direct-route boundaries protect write and company-admin surfaces", () => {
  const combined = guardedLayouts.join("\n");
  assert.equal((combined.match(/requireWorkspaceWriteRole/g) ?? []).length, 3);
  assert.equal((combined.match(/requireWorkspaceAdmin/g) ?? []).length, 3);
});

test("UX1.5 Viewer is read-only on Network interaction surfaces", () => {
  assert.match(networkProfile, /canInteractWithNetwork\(membership\.role\)/);
  assert.match(networkProfile, /organizationId && canInteract/);
  assert.match(networkProfile, /inquiryEligible && canInteract/);
  assert.match(inquiries, /const canInteract = canInteractWithNetwork\(context\.role\)/);
  assert.match(inquiries, /canInteract && box === "received"/);
  assert.match(networkActions, /requireWorkspaceWriteRole/);
});

test("UX1.5 sensitive Server Actions fail closed by role", () => {
  assert.match(uploadActions, /await requireWorkspaceWriteRole\(\)/);
  assert.ok((bulkActions.match(/await requireWorkspaceWriteRole\(\)/g) ?? []).length >= 3);
  assert.ok((reviewActions.match(/await requireWorkspaceWriteRole\(\)/g) ?? []).length >= 2);
  assert.match(dataSourceActions, /await requireWorkspaceAdmin\(\)/);
  assert.match(pilotActions, /await requireWorkspaceAdmin\(\)/);
  assert.match(networkActions, /await requireWorkspaceAdmin\(\)/);
});

test("UX1.5 Platform Superadmin remains independent from tenant membership", () => {
  assert.match(platformLayout, /requirePlatformContext/);
  assert.doesNotMatch(platformLayout, /getWorkspaceContext/);
  assert.match(context, /if \(error \|\| data !== true\) redirect\("\/dashboard"\)/);
});
