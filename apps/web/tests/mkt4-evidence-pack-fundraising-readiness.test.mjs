import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const routes = read("../lib/routes.ts");
const readiness = read("../lib/marketing-fundraising-readiness.ts");
const readinessView = read("../components/fundraising-readiness-view.tsx");
const deck = read("../components/pitch-deck-foundation.tsx");
const deckPage = read("../app/(platform)/platform/marketing/pitch-deck/page.tsx");
const page = read("../app/(platform)/platform/marketing/fundraising-readiness/page.tsx");
const assets = read("../lib/marketing-investor-narrative.ts");
const library = read("../components/investor-narrative-library.tsx");
const investorMarketing = read("../app/(public)/investor/marketing/[inviteToken]/page.tsx");

test("MKT4 codifies a bottom-up €1M working Seed recommendation", () => {
  assert.match(readiness, /targetAmount: 1_000_000/);
  assert.match(readiness, /corridorMin: 800_000/);
  assert.match(readiness, /corridorMax: 1_200_000/);
  assert.match(readiness, /leadMin: 400_000/);
  assert.match(readiness, /leadMax: 700_000/);
  assert.match(readiness, /runwayMonths: 24/);
  assert.match(readiness, /teamSize: 5/);
  assert.match(readiness, /reserve: 130_000/);
  assert.match(readinessView, /Working recommendation/);
  assert.match(readinessView, /valuation, dilution/i);
});

test("MKT4 use of funds reconciles exactly to €1M and 100 percent", () => {
  const amounts = [...readiness.matchAll(/amount: ([0-9_]+)/g)]
    .slice(0, 7)
    .map((match) => Number(match[1].replaceAll("_", "")));
  const percents = [...readiness.matchAll(/percent: ([0-9.]+)/g)]
    .slice(0, 7)
    .map((match) => Number(match[1]));
  assert.equal(amounts.reduce((sum, value) => sum + value, 0), 1_000_000);
  assert.equal(percents.reduce((sum, value) => sum + value, 0), 100);
  assert.match(readiness, /amount: 585_000/);
  assert.match(readiness, /amount: 100_000/);
  assert.match(readiness, /amount: 95_000/);
});

test("MKT4 milestone contract preserves the approved first paid cohort gates", () => {
  assert.match(readiness, /50 activated organizations/);
  assert.match(readiness, /5 distinct self-service paying organizations/);
  assert.match(readiness, /At least 4 of the first 5 buy without a mandatory sales call/);
  assert.match(readiness, /At least 3 paid organizations remain paid after 60 days/);
  assert.match(readiness, /cross-border activation corridor/);
});

test("MKT4 evidence pack maps all 14 slides and blocks traction until real evidence exists", () => {
  for (let slide = 1; slide <= 14; slide += 1) {
    assert.match(readiness, new RegExp(`slide: ${slide},`));
  }
  assert.match(readiness, /key: "traction"[\s\S]*readiness: "blocked"/);
  assert.match(readiness, /key: "product"[\s\S]*readiness: "ready"/);
  assert.match(readiness, /key: "execution"[\s\S]*readiness: "ready"/);
  assert.match(deck, /getFundraisingReadiness/);
  assert.match(deck, /MKT4 next action/);
});

test("MKT4 screenshot matrix refuses blind approval", () => {
  assert.match(readiness, /ScreenshotReadiness = "candidate" \| "approved_for_deck" \| "blocked"/);
  const declared = [...readiness.matchAll(/readiness: "(candidate|approved_for_deck|blocked)"/g)].map((match) => match[1]);
  assert.ok(declared.filter((value) => value === "candidate").length >= 7);
  assert.equal(declared.filter((value) => value === "approved_for_deck").length, 0);
  assert.match(readinessView, /No screenshot is approved blindly/);
});

test("MKT4 remains owner-only and cannot leak through the investor Marketing surface", () => {
  assert.match(routes, /marketingFundraisingReadiness: "\/platform\/marketing\/fundraising-readiness"/);
  assert.match(page, /requirePlatformSuperadmin\(\)/);
  assert.match(assets, /key: "fundraising-readiness"[\s\S]*visibility: "internal"/);
  assert.match(library, /asset\.key === "fundraising-readiness"/);
  assert.match(deckPage, /marketingFundraisingReadiness/);
  assert.doesNotMatch(investorMarketing, /FundraisingReadinessView/);
  assert.doesNotMatch(investorMarketing, /fundraising-readiness/);
});
