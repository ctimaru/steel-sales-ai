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
  assert.match(view, /TAM\/SAM\/SOM and final break-even timing remain intentionally unclaimed/);
  assert.match(view, /Evidence discipline/);
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
  assert.match(content, /Investor Draft 0\.8/);
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


test("L27.2B keeps the synthetic scenario clearly separated from customer evidence", () => {
  assert.match(content, /Investor Draft 0\.8/);
  assert.match(content, /export const syntheticInterviewSimulation/);
  assert.match(content, /Synthetic scenario only/);
  assert.match(view, /Synthetic scenario · internal only/);
  assert.match(view, /Not customer evidence/);
});

test("L27.2B.3 resets monetization to a permanent freemium product-led model", () => {
  assert.match(content, /Permanent Free Base \+ optional low-cost modules \+ simple self-service bundle/);
  assert.match(content, /mandatory paid pilot/);
  assert.match(content, /€299–€799 Core\/Pro ladder/);
  assert.match(content, /export const packagingBoundaryDecision/);
  assert.match(content, /Free Base → Memory\+/);
  assert.match(content, /Free Base → AI\+/);
  assert.match(content, /Free Base → Team\+/);
  assert.match(content, /Marketplace → Premium actions/);
  assert.match(content, /export const valueMetricDecision/);
  assert.match(content, /Optional paid module adoption per organization/);
  assert.match(content, /export const pricingHypotheses/);
  assert.match(content, /SSS Free/);
  assert.match(content, /Working anchor €15 \/ organization \/ month/);
  assert.match(content, /Working anchor €39 \/ organization \/ month/);
  assert.match(content, /export const freemiumModuleCards/);
  assert.match(content, /€0 forever/);
  assert.match(content, /MEMORY\+/);
  assert.match(content, /AI\+/);
  assert.match(content, /TEAM\+/);
  assert.match(content, /export const selfServeMonetizationModel/);
  assert.match(content, /activated organizations/);
  assert.match(content, /No sales call required to unlock normal paid modules/);
  assert.match(content, /export const productLedValidationGate/);
  assert.match(content, /At least 5 distinct organizations purchase a module or SSS Plus through self-service/);
  assert.match(content, /5–10% activated-to-paid conversion band/);
  assert.match(content, /Sales-assisted revenue can coexist later but is not required evidence/);
  assert.match(view, /Freemium &amp; product-led pricing reset/);
  assert.match(view, /Free first\. Pay only to deepen value\./);
  assert.match(view, /The paywall comes after the aha moment/);
  assert.match(view, /No sales funnel required/);
  assert.match(view, /Product-led evidence scale/);
  assert.match(view, /Early validation gate/);
  assert.doesNotMatch(view, /Behavior before stated willingness/);
});



test("L27.2C adds network economics, multiple income streams and scenario sensitivity without presenting forecasts as traction", () => {
  assert.match(content, /Investor Draft 0\.8/);
  assert.match(content, /export const networkEconomicsThesis/);
  assert.match(content, /business network layer for the steel and tube industry/);
  assert.match(content, /Build the steel industry's business network first/);
  assert.match(content, /export const networkNorthStarMetrics/);
  assert.match(content, /Monthly active organizations \(MAO\)/);
  assert.match(content, /Meaningful interactions \/ MAO/);
  assert.match(content, /Cross-side liquidity/);
  assert.match(content, /export const networkIncomeStreams/);
  assert.match(content, /Freemium modules \+ SSS Plus/);
  assert.match(content, /Marketplace premium actions/);
  assert.match(content, /Sponsored industry visibility/);
  assert.match(content, /Aggregated industry intelligence/);
  assert.match(content, /API \/ integrations \/ enterprise services/);
  assert.match(content, /private commercial memory is never sold/);
  assert.match(content, /export const unitEconomicsGuardrails/);
  assert.match(content, /≤ €0\.75 \/ MAO \/ month/);
  assert.match(content, /≤ 25% of revenue/);
  assert.match(content, /export const networkScaleScenarios/);
  assert.match(content, /Italy network/);
  assert.match(content, /European network/);
  assert.match(content, /Network scale/);
  assert.match(content, /€44\.4k/);
  assert.match(content, /€383\.9k/);
  assert.match(content, /€2\.262m/);
  assert.match(content, /These are internal sensitivity scenarios, not forecasts/);
  assert.match(content, /export const breakEvenFramework/);
  assert.match(content, /Break-even occurs when this contribution covers fixed monthly operating expense/);
  assert.match(content, /export const investorMilestones/);
  assert.match(view, /Network economics &amp; multi-stream financial model/);
  assert.match(view, /Value grows with users, companies and usage/);
  assert.match(view, /Multiple income streams/);
  assert.match(view, /Network scale sensitivity/);
  assert.match(view, /Sensitivity model · not forecast/);
  assert.match(view, /Investor milestones/);
});
