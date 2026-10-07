import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const routes = read("../lib/routes.ts");
const fundraising = read("../lib/marketing-fundraising-assets.ts");
const assets = read("../lib/marketing-investor-narrative.ts");
const library = read("../components/investor-narrative-library.tsx");
const onePager = read("../components/investor-one-pager.tsx");
const pitchDeck = read("../components/pitch-deck-foundation.tsx");
const ownerOnePager = read("../app/(platform)/platform/marketing/one-pager/page.tsx");
const ownerDeck = read("../app/(platform)/platform/marketing/pitch-deck/page.tsx");
const investorOnePager = read("../app/(public)/investor/marketing/[inviteToken]/one-pager/page.tsx");

test("MKT3 defines a claim-status contract for fundraising material", () => {
  assert.match(fundraising, /ClaimStatus = "fact" \| "estimate" \| "hypothesis" \| "target"/);
  assert.match(fundraising, /Feature costruite ≠ traction|feature costruite ≠ traction/i);
  assert.match(fundraising, /replacement cost ≠ valuation/i);
  assert.match(fundraising, /€1M è la working recommendation/);
  assert.match(fundraising, /Terms · TBD/);
});

test("MKT3 one-pager covers problem, why-now, product, market, moat, execution and vision", () => {
  for (const key of ["problem", "why-now", "product", "market", "moat", "execution", "vision"]) {
    assert.match(fundraising, new RegExp(`key: "${key}"`));
  }
  assert.match(onePager, /Validation gaps/);
  assert.match(onePager, /statusLabel/);
  assert.match(onePager, /Smart Steel Sales · smartsteelsales\.com/);
});

test("MKT3 pitch deck foundation remains explicitly internal", () => {
  assert.match(fundraising, /number: 14/);
  assert.match(pitchDeck, /Internal only/);
  assert.match(ownerDeck, /requirePlatformSuperadmin\(\)/);
  assert.match(assets, /key: "pitch-deck-foundation"[\s\S]*visibility: "internal"/);
  assert.doesNotMatch(investorOnePager, /PitchDeckFoundation/);
});

test("MKT3 one-pager is an approved marketing-scope investor asset", () => {
  assert.match(assets, /key: "one-pager"[\s\S]*maturity: "approved"[\s\S]*visibility: "investor_visible"[\s\S]*requiredScope: "marketing"/);
  assert.match(routes, /marketingOnePager: "\/platform\/marketing\/one-pager"/);
  assert.match(routes, /marketingPitchDeck: "\/platform\/marketing\/pitch-deck"/);
  assert.match(library, /asset\.key === "one-pager"/);
  assert.match(library, /\/investor\/marketing\/\$\{inviteToken\}\/one-pager/);
  assert.match(ownerOnePager, /requirePlatformSuperadmin\(\)/);
  assert.match(investorOnePager, /validateInvestorAccessSession\(inviteToken, parsed\.sessionToken, "marketing"\)/);
  assert.match(investorOnePager, /index: false/);
});
