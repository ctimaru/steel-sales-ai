import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const narrative = read("../lib/marketing-investor-narrative.ts");
const library = read("../components/investor-narrative-library.tsx");
const platformPage = read("../app/(platform)/platform/marketing/page.tsx");
const investorPage = read("../app/(public)/investor/marketing/[inviteToken]/page.tsx");

test("MKT2 defines a disciplined investor narrative with explicit validation gaps", () => {
  assert.match(narrative, /Pre-launch · pilot readiness/);
  assert.match(narrative, /Feature costruite ≠ traction|feature costruite ≠ traction/i);
  assert.match(narrative, /seed database ≠ network liquidity/i);
  assert.match(narrative, /replacement cost ≠ valuation/i);
  assert.match(narrative, /Free-to-paid conversion/);
  assert.match(narrative, /30\/90-day retention/);
});

test("MKT2 asset library separates maturity from visibility", () => {
  assert.match(narrative, /MarketingAssetMaturity = "approved" \| "draft" \| "planned"/);
  assert.match(narrative, /"internal"\s*\|\s*"investor_visible"/);
  assert.match(narrative, /visibility: "investor_visible"/);
  assert.match(narrative, /visibility: "internal"/);
  assert.match(narrative, /visibility: "scope_business_plan"/);
  assert.match(narrative, /visibility: "scope_kpi"/);
});

test("MKT2 investor library filters private assets and respects invitation scopes", () => {
  assert.match(library, /if \(!investorMode\) return true/);
  assert.match(library, /asset\.visibility === "internal"/);
  assert.match(library, /scopes\.includes\(asset\.requiredScope\)/);
  assert.match(library, /asset\.key === "business-plan"/);
  assert.match(library, /asset\.key === "kpi-dashboard"/);
  assert.match(library, /\/investor\/business-plan\/\$\{inviteToken\}/);
  assert.match(library, /\/investor\/kpi\/\$\{inviteToken\}/);
});

test("MKT2 is rendered in both owner and investor Marketing rooms", () => {
  assert.match(platformPage, /InvestorNarrativeLibrary locale=\{locale\}/);
  assert.match(investorPage, /InvestorNarrativeLibrary/);
  assert.match(investorPage, /scopes=\{access\.scopes\}/);
  assert.match(investorPage, /validateInvestorAccessSession/);
  assert.match(investorPage, /"marketing"/);
  assert.match(investorPage, /index: false/);
});
