import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const routes = read("../lib/routes.ts");
const readiness = read("../lib/marketing-fundraising-readiness.ts");
const deck = read("../components/investor-deck-production.tsx");
const qa = read("../components/visual-evidence-qa.tsx");
const deckPage = read("../app/(platform)/platform/marketing/investor-deck/page.tsx");
const qaPage = read("../app/(platform)/platform/marketing/visual-evidence-qa/page.tsx");
const assets = read("../lib/marketing-investor-narrative.ts");
const library = read("../components/investor-narrative-library.tsx");
const investorMarketing = read("../app/(public)/investor/marketing/[inviteToken]/page.tsx");

test("MKT5 produces a real 14-slide internal deck", () => {
  for (let slide = 1; slide <= 14; slide += 1) {
    assert.match(deck, new RegExp(`number=\\{${slide}\\}`));
  }
  assert.match(deck, /aspect-\[16\/9\]/);
  assert.match(deck, /Investor Deck Draft · MKT5/);
  assert.match(deckPage, /requirePlatformSuperadmin\(\)/);
  assert.match(routes, /marketingInvestorDeck: "\/platform\/marketing\/investor-deck"/);
});

test("MKT5 keeps the traction slide explicitly blocked", () => {
  assert.match(readiness, /key: "traction"[\s\S]*readiness: "blocked"/);
  assert.match(deck, /We do not invent a traction slide before traction exists/);
  assert.match(deck, /5 paying organizations/);
  assert.match(deck, /3 retained after 60 days/);
});

test("MKT5 approves only live-verified public desktop visuals", () => {
  assert.match(readiness, /key: "public-home"[\s\S]*readiness: "approved_for_deck"[\s\S]*desktopVerified: true[\s\S]*mobileVerified: false/);
  assert.match(readiness, /key: "school"[\s\S]*surface: "\/knowledge"[\s\S]*readiness: "approved_for_deck"[\s\S]*desktopVerified: true[\s\S]*mobileVerified: false/);
  assert.match(readiness, /key: "commercial-memory"[\s\S]*readiness: "candidate"[\s\S]*desktopVerified: false/);
  assert.match(readiness, /key: "rfq-hub"[\s\S]*readiness: "candidate"[\s\S]*desktopVerified: false/);
  assert.match(qa, /Mobile remains unverified/);
});

test("MKT5 visual QA and production deck remain owner-only", () => {
  assert.match(routes, /marketingVisualEvidenceQa: "\/platform\/marketing\/visual-evidence-qa"/);
  assert.match(qaPage, /requirePlatformSuperadmin\(\)/);
  assert.match(assets, /key: "investor-deck"[\s\S]*maturity: "approved"[\s\S]*visibility: "internal"/);
  assert.match(assets, /key: "visual-evidence-qa"[\s\S]*visibility: "internal"/);
  assert.match(library, /asset\.key === "investor-deck"/);
  assert.match(library, /asset\.key === "visual-evidence-qa"/);
  assert.doesNotMatch(investorMarketing, /InvestorDeckProduction/);
  assert.doesNotMatch(investorMarketing, /VisualEvidenceQa/);
});

test("MKT5 keeps the working ask governed rather than presenting financing terms", () => {
  assert.match(deck, /€1,0M/);
  assert.match(deck, /€0,8–1,2M corridor/);
  assert.match(deck, /Working recommendation · valuation & terms TBD/);
  assert.doesNotMatch(deck, /pre-money valuation/i);
});
