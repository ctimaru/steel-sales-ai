import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const modelSource = read("../lib/private-business-plan-market-sizing.ts");
const tabs = read("../components/business-plan-tabs.tsx");
const view = read("../components/private-business-plan-market-sizing.tsx");
const ownerPage = read("../app/(platform)/platform/business-plan/market-sizing/page.tsx");
const ownerHighlights = read("../app/(platform)/platform/business-plan/page.tsx");
const ownerDetails = read("../app/(platform)/platform/business-plan/details/page.tsx");
const externalHighlights = read("../app/(public)/investor/business-plan/[inviteToken]/page.tsx");
const externalDetails = read("../app/(public)/investor/business-plan/[inviteToken]/details/page.tsx");
const routes = read("../lib/routes.ts");
const { outputText } = ts.transpileModule(modelSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const model = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));

test("BP-MKT1 algebra produces repeatable TAM, Italy SAM and three conservative SOM sensitivities", () => {
  const r = model.calculateMarketModel();
  assert.equal(r.paidArpaMonthly, 29.4);
  assert.equal(r.tam.organizations, 115500);
  assert.equal(r.tam.annualSoftwareSpendCeilingEur, 40748400);
  assert.equal(r.italyQualified.organizations, 24000);
  assert.equal(r.sam.organizations, 9600);
  assert.equal(r.sam.annualSoftwareSpendCeilingEur, 3386880);
  assert.deepEqual(r.som.map(x => x.activatedOrganizations), [768,1920,3360]);
  assert.deepEqual(r.som.map(x => x.payingOrganizations), [61,230,605]);
  assert.deepEqual(r.som.map(x => x.arrEur), [21520.8,81144,213444]);
  assert.deepEqual(r.som.map(x => x.usersWithinPayingOrganizations), [153,575,1513]);
});

test("BP-MKT1 price-mix sensitivity is exact and never changes the number of payers", () => {
  const variants = model.pricingMixSensitivity(230);
  assert.deepEqual(variants.map(v=>v.monthlyArpaEur),[19.8,29.4,34.2]);
  assert.deepEqual(variants.map(v=>v.arrEur),[54648,81144,94392]);
  assert.equal(variants[1].plusShare,0.6);
});

test("BP-MKT1 is organization-billed and rejects pricing mixes that overcount buyers", () => {
  const base = model.calculateMarketModel();
  const varied = model.calculateMarketModel({ ...model.marketModelInputs, usersPerActivatedOrganization: 8 });
  assert.equal(varied.sam.annualSoftwareSpendCeilingEur, base.sam.annualSoftwareSpendCeilingEur);
  assert.deepEqual(varied.som.map(x=>x.arrEur),base.som.map(x=>x.arrEur));
  assert.notDeepEqual(varied.som.map(x=>x.usersWithinPayingOrganizations),base.som.map(x=>x.usersWithinPayingOrganizations));
  assert.throws(() => model.calculateMarketModel({ ...model.marketModelInputs, plusShareAmongPayers: 0.7 }),/100%/);
  assert.throws(() => model.calculateMarketModel({ ...model.marketModelInputs, italianRelevantShare: -0.1 }),/between 0 and 1/);
});

test("BP-MKT1 separates source evidence from hypothetical fit and no population is summed", () => {
  assert.equal(model.sourceLedger.find(x=>x.label.startsWith("ASSOFERMET · distributor"))?.number, 160000);
  assert.equal(model.sourceLedger.find(x=>x.label.startsWith("Orgalim"))?.number, 770000);
  assert.equal(model.sourceLedger.length, 7);
  assert.match(model.marketModelGovernance.confidence, /LOW/);
  assert.match(model.marketModelGovernance.tamCaveat, /NOT a strictly nested census/);
  assert.match(model.marketModelGovernance.calibration.join(" "), /crawler/);
  assert.match(model.marketModelGovernance.economicBasis, /Marketplace premium/);
  assert.match(view,/marketModelGovernance/);
  assert.match(view,/sourceLedger/);
});

test("BP-MKT1 only exposes the market sizing tab to private platform owner view", () => {
  assert.match(routes,/businessPlanMarketSizing: "\/platform\/business-plan\/market-sizing"/);
  assert.match(ownerPage,/await requirePlatformSuperadmin\(\)/);
  assert.match(ownerPage,/dynamic = "force-dynamic"/);
  assert.match(ownerPage,/revalidate = 0/);
  assert.match(ownerPage,/robots: \{ index: false, follow: false/);
  assert.match(ownerPage,/<PrivateBusinessPlanMarketSizing locale=\{locale\}/);
  assert.match(tabs,/showPrivateMarketSizing = false/);
  assert.match(tabs,/showPrivateMarketSizing\s*\?/);
  assert.match(ownerHighlights,/showPrivateMarketSizing/);
  assert.match(ownerDetails,/showPrivateMarketSizing/);
  assert.doesNotMatch(externalHighlights,/showPrivateMarketSizing/);
  assert.doesNotMatch(externalDetails,/showPrivateMarketSizing/);
  assert.doesNotMatch(externalHighlights,/private-business-plan-market-sizing/);
  assert.doesNotMatch(externalDetails,/private-business-plan-market-sizing/);
});

test("BP-MKT1 private view communicates pricing hypotheses and human validation", () => {
  assert.match(view,/TAM → SAM → SOM/);
  assert.match(view,/BOZZA INTERNA/);
  assert.match(view,/INTERNAL DRAFT/);
  assert.match(view,/15%/);
  assert.match(view,/40%/);
  assert.match(view,/40% modulo \/ 60% Plus/);
  assert.match(view,/non pagano ulteriormente per seat/);
  assert.match(view,/non costituiscono un censimento deduplicato/);
});
