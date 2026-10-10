import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const platformIa = fs.readFileSync(new URL("../lib/platform-ia-contract.ts", import.meta.url), "utf8");

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const globals = read("../app/globals.css");
const focusUi = read("../components/focus-ui.tsx");
const routes = read("../lib/routes.ts");
const navigation = read("../components/platform-navigation.tsx");
const marketingPage = read("../app/(platform)/platform/marketing/page.tsx");
const marketingView = read("../components/marketing-principles-view.tsx");
const marketingContent = read("../lib/marketing-content.ts");
const investorTypes = read("../lib/investor-business-plan.ts");
const investorActions = read("../app/(platform)/platform/investor-access/actions.ts");
const investorAccess = read("../app/(platform)/platform/investor-access/page.tsx");
const investorPortal = read("../app/(public)/investor/access/[inviteToken]/page.tsx");
const investorMarketing = read("../app/(public)/investor/marketing/[inviteToken]/page.tsx");
const migration = read("../../../supabase/migrations/20261007115403_mkt1_marketing_investor_scope.sql");

test("UXC1 establishes the approved semantic palette at the global layer", () => {
  for (const token of [
    "--brand-deep: #123b34",
    "--brand-primary: #1f6b5a",
    "--brand-primary-hover: #185247",
    "--brand-primary-soft: #ddf5ec",
    "--text-primary: #0f1720",
    "--text-secondary: #475569",
    "--surface-canvas: #f6f8f7",
    "--steel-blue: #315c74",
    "--semantic-warning: #a15c00",
    "--semantic-error: #b42318",
  ]) {
    assert.match(globals, new RegExp(token.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(globals, /--focus: var\(--steel-blue\)/);
  assert.match(focusUi, /var\(--text-primary\)/);
  assert.match(focusUi, /var\(--text-secondary\)/);
});

test("MKT1 is an owner-only Platform Console surface", () => {
  assert.match(routes, /marketing: "\/platform\/marketing"/);
  assert.match(platformIa, /label: "Marketing e materiali"/);
  assert.match(platformIa, /href: appRoutes\.platform\.marketing/);
  assert.match(marketingPage, /requirePlatformSuperadmin\(\)/);
  assert.match(marketingPage, /MarketingPrinciplesView/);
  assert.match(marketingView, /WCAG 2\.2 AA/);
  assert.match(marketingContent, /Il verde è la firma/);
  assert.match(marketingContent, /Green is the signature/);
});

test("MKT1 investor access is scoped and does not reuse Platform Console authority", () => {
  assert.match(investorTypes, /"business_plan" \| "marketing" \| "kpi"/);
  assert.match(investorActions, /\["business_plan", "marketing", "kpi"\]/);
  assert.match(investorAccess, /name="marketing"/);
  assert.match(investorPortal, /access\.scopes\.includes\("marketing"\)/);
  assert.match(investorMarketing, /validateInvestorAccessSession/);
  assert.match(investorMarketing, /"marketing"/);
  assert.doesNotMatch(investorMarketing, /requirePlatformSuperadmin/);
  assert.match(investorMarketing, /index: false/);
});

test("MKT1 database contract allows only the three explicit investor scopes", () => {
  assert.match(migration, /array\['business_plan','marketing','kpi'\]::text\[\]/);
  assert.match(migration, /where scope in \('business_plan','marketing','kpi'\)/);
  assert.match(migration, /private\.is_platform_superadmin\(\)/);
  assert.doesNotMatch(migration, /create table/i);
});
