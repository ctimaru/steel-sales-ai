import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const access = read("../lib/access-policy.ts");
const profiles = read("../lib/office-profiles.ts");

const compiled = ts.transpileModule(
  access + "\n" + profiles.replace(/^import \{[^}]*\} from "@\/lib\/access-policy";\s*/u, ""),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const {
  canReadOffice, canWriteOffice, canManageOfficeProfiles, officeProfileOf, businessRoleLabel,
  normalizeTeamProfile, teamProfileOf, teamAccessFor,
} = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

test("OFFICE-PROFILES1 every profile consults both offices", () => {
  for (const role of ["admin", "member", "viewer"]) {
    for (const area of ["commercial", "purchasing"]) assert.equal(canReadOffice(role, area), true);
  }
});

test("OFFICE-PROFILES1 writes only in the own office; Direzione writes in both", () => {
  assert.equal(canWriteOffice("member", "salesperson", "commercial"), true);
  assert.equal(canWriteOffice("member", "salesperson", "purchasing"), false);
  assert.equal(canWriteOffice("member", "purchasing", "purchasing"), true);
  assert.equal(canWriteOffice("member", "purchasing", "commercial"), false);
  assert.equal(canWriteOffice("admin", null, "commercial"), true);
  assert.equal(canWriteOffice("admin", "purchasing", "commercial"), true, "An admin is always Direzione");
  assert.equal(canWriteOffice("member", "sales_director", "purchasing"), true);
});

test("OFFICE-PROFILES1 never widens access: viewers stay read-only, legacy members keep today's write", () => {
  assert.equal(canWriteOffice("viewer", "purchasing", "purchasing"), false);
  assert.equal(canWriteOffice("viewer", null, "commercial"), false);
  assert.equal(canWriteOffice("member", null, "commercial"), true);
  assert.equal(canWriteOffice("member", null, "purchasing"), true);
  assert.equal(canWriteOffice("member", "operations", "purchasing"), true);
  assert.equal(canWriteOffice("member", "not-a-role", "commercial"), true);
});

test("OFFICE-PROFILES1 only an admin assigns profiles", () => {
  assert.equal(canManageOfficeProfiles("admin"), true);
  assert.equal(canManageOfficeProfiles("member"), false);
  assert.equal(canManageOfficeProfiles("viewer"), false);
  assert.equal(officeProfileOf("member", "sales_director"), "direction");
  assert.equal(officeProfileOf("member", "purchasing"), "purchasing");
  assert.equal(officeProfileOf("member", "salesperson"), "commercial");
  assert.equal(officeProfileOf("member", null), null);
  assert.equal(businessRoleLabel("purchasing"), "Ufficio acquisti");
  assert.equal(businessRoleLabel(null), "Non assegnato");
});

test("OFFICE-PROFILES1 wiring: migration, worker, team UI and RFQ chat respect the profile", () => {
  const migration = read("../../../supabase/migrations/20261109100000_office_profiles_purchasing.sql");
  assert.match(migration, /'sales_director', 'salesperson', 'purchasing', 'operations'/);
  assert.doesNotMatch(migration, /create policy|alter policy|drop policy|enable row level security/i,
    "Profiles migration must not touch RLS");
  assert.match(read("../../../services/worker/app/tenant_admin.py"), /"purchasing"/);
  // TEAM-PROFILES2: un solo campo «Profilo» con i tre uffici.
  assert.match(read("../app/(italian)/(workspace)/company/team/page.tsx"), /\{ value: "purchasing", label: officeProfileLabels\.purchasing \}/);
  const page = read("../app/(italian)/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");
  assert.match(page, /canWriteOffice\(workspace\.role, workspace\.businessRole, "purchasing"\)/);
  assert.match(page, /purchasingWrite &&/);
  const chat = read("../components/rfqc1-chat-workspace.tsx");
  assert.match(chat, /data-testid="rfqc1-new-request"/);
  assert.match(chat, /readOnlyByProfile/);

  // Applicazione lato server: nessuna scrittura RFQ parte da un profilo in sola consultazione.
  const base = "../app/(italian)/(workspace)/marketplace/rfq-hub/";
  for (const [file, fns] of [
    ["actions.ts", ["addSupplierToBuyerRfq", "launchBuyerRfq", "retryFailedBuyerRfq", "sendBuyerRfqReminders"]],
    ["[rfqId]/award-actions.ts", ["confirmRfqAward"]],
    ["[rfqId]/po-actions.ts", ["updatePurchaseOrderTerms", "issuePurchaseOrder"]],
    ["[rfqId]/negotiation-actions.ts", ["postBuyerRfqNegotiation", "sendBuyerNegotiationReminder"]],
  ]) {
    const source = read(base + file);
    for (const fn of fns) {
      const body = source.slice(source.indexOf("export async function " + fn));
      const guardAt = body.indexOf('officeWriteDenied("purchasing")');
      assert.ok(guardAt > 0 && guardAt < 1400, fn + " must check the office profile first");
    }
  }
});

// TEAM-PROFILES2 (founder decisions, 26 nov 2026): un solo «Profilo» in Team e profili.
test("TEAM-PROFILES2 one Profilo field: Direzione = admin, offices = member/viewer + business role", () => {
  assert.equal(teamProfileOf("admin", null), "direction");
  assert.equal(teamProfileOf("admin", "salesperson"), "direction");
  assert.equal(teamProfileOf("member", "salesperson"), "commercial");
  assert.equal(teamProfileOf("viewer", "purchasing"), "purchasing");
  assert.equal(teamProfileOf("member", "sales_director"), "legacy", "old profiles are shown, never silently mapped");
  assert.equal(teamProfileOf("member", "operations"), "legacy");
  assert.equal(teamProfileOf("member", null), null);

  assert.deepEqual(teamAccessFor("direction", true), { role: "admin", businessRole: null }, "Direzione is never read-only");
  assert.deepEqual(teamAccessFor("commercial", false), { role: "member", businessRole: "salesperson" });
  assert.deepEqual(teamAccessFor("purchasing", true), { role: "viewer", businessRole: "purchasing" });

  assert.equal(normalizeTeamProfile("purchasing"), "purchasing");
  assert.equal(normalizeTeamProfile("sales_director"), null, "old profiles can no longer be assigned");
  assert.equal(normalizeTeamProfile("operations"), null);
  assert.equal(normalizeTeamProfile(undefined), null);
});

test("TEAM-PROFILES2 page and actions: one form per person, self protected, sidebar kept", () => {
  const page = read("../app/(italian)/(workspace)/company/team/page.tsx");
  assert.doesNotMatch(page, /value="sales_director"|value="operations"/, "old profiles are not offered");
  assert.match(page, /title: "Team e profili"/);
  assert.match(page, /<TeamMemberProfileForm/);
  assert.match(page, /Sospendi accesso/);
  for (const id of ["team-group-assign", "team-group-", "team-invitations", "team-invite"]) assert.ok(page.includes(id), id);
  const form = read("../components/team-member-profile-form.tsx");
  assert.match(form, /^"use client";/);
  assert.match(form, /action=\{changeMemberProfile\}/);
  assert.match(form, /const changed = value !== current && value !== "";/);
  const actions = read("../app/(italian)/onboarding/actions.ts");
  assert.match(actions, /export async function changeMemberProfile/);
  assert.match(actions, /if \(userId === context\.userId\) teamRedirect/);
  assert.ok(actions.indexOf('"set_organization_member_role", {\n    p_organization_id: context.organizationId,\n    p_user_id: userId,\n    p_role: access.role')
    < actions.indexOf("p_business_role: access.businessRole"), "permission first: last-admin guard stops before any change");
  assert.match(actions, /const profile = normalizeTeamProfile\(formData\.get\("profile"\)\);/);
  const ia = read("../lib/workspace-information-architecture.ts");
  assert.match(ia, /appRoutes\.commercial\.home,\n\s*\/\/ TEAM-PROFILES2[^\n]*\n[^\n]*\n\s*appRoutes\.company\.team,/);
  const desk = read("../app/(italian)/(workspace)/commercial/direzione/page.tsx");
  assert.doesNotMatch(desk, />\s*Team e profili\s*</, "no duplicate Team e profili button on the Scrivania");
});
