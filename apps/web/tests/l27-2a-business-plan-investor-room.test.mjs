import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const routes = read("../lib/routes.ts");
const nav = read("../components/platform-navigation.tsx");
const ownerPage = read("../app/(platform)/platform/business-plan/page.tsx");
const ownerActions = read("../app/(platform)/platform/business-plan/actions.ts");
const investorPage = read("../app/(public)/investor/business-plan/[inviteToken]/page.tsx");
const investorActions = read("../app/(public)/investor/business-plan/[inviteToken]/actions.ts");
const access = read("../lib/investor-business-plan.ts");
const content = read("../lib/business-plan-content.ts");
const view = read("../components/business-plan-view.tsx");

test("L27.2A adds an owner-only Business Plan surface to Platform", () => {
  assert.match(routes, /businessPlan: "\/platform\/business-plan"/);
  assert.match(nav, /label: "Business Plan"/);
  assert.match(nav, /staffEnabled: false/);
  assert.match(ownerPage, /requirePlatformSuperadmin\(\)/);
  assert.match(ownerActions, /requirePlatformSuperadmin\(\)/);
});

test("L27.2A external investor view is isolated, noindex and session-gated", () => {
  assert.match(investorPage, /robots:[\s\S]*index: false[\s\S]*follow: false/);
  assert.match(investorPage, /validateInvestorBusinessPlanSession/);
  assert.match(investorPage, /Confidential investor room/);
  assert.match(investorPage, /BusinessPlanView investorMode/);
  assert.doesNotMatch(investorPage, /PlatformShell/);
});

test("L27.2A investor session cookie is httpOnly, secure in production and scoped away from Platform", () => {
  assert.match(investorActions, /httpOnly: true/);
  assert.match(investorActions, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(investorActions, /sameSite: "lax"/);
  assert.match(investorActions, /path: "\/investor\/business-plan"/);
  assert.match(access, /sss_investor_business_plan/);
});

test("L27.2A visual plan distinguishes hypotheses from evidence", () => {
  assert.match(content, /Commercianti \/ stockholder di tubi e acciaio/);
  assert.match(content, /Working hypothesis/);
  assert.match(content, /Sales Director \/ Direttore Commerciale/);
  assert.match(content, /L27\.2B/);
  assert.match(view, /What is proven vs\. what is still a hypothesis/);
  assert.match(view, /TAM\/SAM\/SOM, pricing, revenue scenarios and unit economics/);
  assert.match(view, /Not fabricated yet/);
});
