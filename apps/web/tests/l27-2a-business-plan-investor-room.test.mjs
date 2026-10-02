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
  assert.match(content, /Evidence-supported hypothesis/);
  assert.match(content, /Sales Director \/ Direttore Commerciale/);
  assert.match(content, /L27\.2B/);
  assert.match(view, /What is proven vs\. what is still a hypothesis/);
  assert.match(view, /TAM\/SAM\/SOM, pricing, revenue scenarios and unit economics/);
  assert.match(view, /Not fabricated yet/);
});


test("L27.2A.1 adds sourced market evidence, weighted ICP scoring and beachhead definition", () => {
  assert.match(content, /ASSOFERMET Acciai member companies/);
  assert.match(content, /about 80% of Italian steel distribution/);
  assert.match(content, /~3,500/);
  assert.match(content, /75\.6%/);
  assert.match(content, /21\.1%/);
  assert.match(content, /export const icpDecisionCriteria/);
  assert.match(content, /Pain intensity/);
  assert.match(content, /Commercianti \/ stockholder[\s\S]*score: 4\.9/);
  assert.match(content, /export const beachheadProfile/);
  assert.match(content, /Italian steel\/tube distributor or stockholder/);
  assert.match(content, /export const competitiveAlternatives/);
  assert.match(content, /INVEX, unitop, Metols, MetalTrax/);
  assert.match(view, /Why distribution is the first wedge/);
  assert.match(view, /Weighted ICP scorecard/);
  assert.match(view, /The real competitive set/);
});


test("L27.2A.2 adds a pre-committed ICP interview and validation framework", () => {
  assert.match(content, /Investor Draft 0\.5/);
  assert.match(content, /export const interviewCohortPlan/);
  assert.match(content, /totalInterviews: 18/);
  assert.match(content, /interviews: 10/);
  assert.match(content, /minimumCompanies: 7/);
  assert.match(content, /export const interviewPrinciples/);
  assert.match(content, /Past behaviour before future intention/);
  assert.match(content, /export const interviewScript/);
  assert.match(content, /Recent behaviour/);
  assert.match(content, /Buying process/);
  assert.match(content, /Concept test/);
  assert.match(content, /Commitment/);
  assert.match(content, /export const interviewScoreDimensions/);
  assert.match(content, /Behavioural commitment/);
  assert.match(content, /export const icpValidationGate/);
  assert.match(content, />=70% of distributor interviews/);
  assert.match(content, /<40% of distributor interviews/);
  assert.match(content, /Validated/);
  assert.match(content, /Rejected \/ pivot/);
  assert.match(view, /Interview &amp; validation framework/);
  assert.match(view, /6 dimensions · 12-point fit score/);
  assert.match(view, /Pre-committed validation thresholds/);
  assert.match(view, /One standard record per interview/);
});


test("L27.2B adds synthetic interview scenario and pricing hypotheses without presenting them as evidence", () => {
  assert.match(content, /Investor Draft 0\.5/);
  assert.match(content, /export const syntheticInterviewSimulation/);
  assert.match(content, /Synthetic scenario only/);
  assert.match(content, /Weekly core pain/);
  assert.match(content, /80%/);
  assert.match(content, /export const pricingMarketAnchors/);
  assert.match(content, /Salesforce Sales Cloud/);
  assert.match(content, /Microsoft Dynamics 365 Sales/);
  assert.match(content, /HubSpot Sales Hub/);
  assert.match(content, /Organization subscription \+ included seats \+ optional usage layer/);
  assert.match(content, /Test band €299–€399/);
  assert.match(content, /€199\/month for 90 days/);
  assert.match(content, /€349\/month, 5 users included/);
  assert.match(content, /€749\/month, 10 users included/);
  assert.match(content, /Do not call any price validated based on the synthetic cohort/);
  assert.match(view, /Synthetic scenario · internal only/);
  assert.match(view, /Not customer evidence/);
  assert.match(view, /Working pricing architecture/);
  assert.match(view, /Hypothesis only/);
  assert.match(view, /Preferred monetization model/);
});


test("L27.2B.1 fixes the free-paid boundary and organization value metric without claiming commercial validation", () => {
  assert.match(content, /export const packagingBoundaryDecision/);
  assert.match(content, /Private company memory becomes operational/);
  assert.match(content, /Core → Pro/);
  assert.match(content, /Pro → Enterprise/);
  assert.match(content, /export const valueMetricDecision/);
  assert.match(content, /Organization subscription anchored to active private Commercial Memory/);
  assert.match(content, /Included seats \+ additional seats/);
  assert.match(content, /AI \/ ingestion \/ storage allowance/);
  assert.match(content, /Marketplace unlock \/ response credits/);
  assert.match(content, /Searches of the customer's own commercial history/);
  assert.match(content, /export const valueMetricAlternatives/);
  assert.match(content, /Pure per-seat/);
  assert.match(content, /Pure AI \/ usage consumption/);
  assert.match(content, /export const packagingBoundaryValidationGate/);
  assert.match(content, /At least 3 distinct beachhead companies/);
  assert.match(content, />=40% of completed beachhead companies/);
  assert.match(view, /Packaging boundary &amp; value metric/);
  assert.match(view, /Charge for private company memory, not for every action/);
  assert.match(view, /Directional validation gate/);
});
