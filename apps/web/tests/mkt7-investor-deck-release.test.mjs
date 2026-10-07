import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const release = read("../lib/marketing-investor-deck-release.ts");
const deck = read("../components/investor-deck-production.tsx");
const investorDeckPage = read("../app/(public)/investor/marketing/[inviteToken]/deck/page.tsx");
const investorAccess = read("../app/(public)/investor/access/[inviteToken]/page.tsx");
const assets = read("../lib/marketing-investor-narrative.ts");
const library = read("../components/investor-narrative-library.tsx");
const investorMarketing = read("../app/(public)/investor/marketing/[inviteToken]/page.tsx");

test("MKT7 defines a governed investor deck release contract", () => {
  assert.match(release, /version: "MKT7-RC1"/);
  assert.match(release, /requiredScope: "marketing"/);
  assert.match(release, /investorVisible: true/);
  assert.match(release, /confidential: true/);
  assert.match(release, /readOnly: true/);
  assert.match(release, /noIndex: true/);
  assert.match(release, /includesPrivateDemoScreenshots: false/);
  assert.match(release, /"public-home", "school"/);
});

test("MKT7 investor deck route requires a valid marketing-scoped investor session", () => {
  assert.match(investorDeckPage, /validateInvestorAccessSession/);
  assert.match(investorDeckPage, /investorDeckRelease\.requiredScope/);
  assert.match(investorDeckPage, /redirect\(/);
  assert.match(investorDeckPage, /investor\/access/);
  assert.match(investorDeckPage, /robots: \{ index: false, follow: false, noarchive: true, nocache: true \}/);
  assert.match(investorDeckPage, /<InvestorDeckProduction investorMode locale=\{locale\} \/>/);
});

test("MKT7 investor-safe deck hides internal readiness workflow and internal next actions", () => {
  assert.match(deck, /!investorMode \? \(/);
  assert.match(deck, /investorDeckReleaseFooter/);
  assert.match(deck, /Confidential Investor Deck/);
  assert.match(deck, /investorMode \? "PRE-LAUNCH" : "BLOCKED"/);
  assert.match(release, /Problem thesis · external validation in progress/);
  assert.match(release, /no external traction claimed/);
  assert.match(release, /Working recommendation · valuation & terms TBD/);
});

test("MKT7 promotes only the governed deck asset to investor-visible marketing scope", () => {
  assert.match(assets, /key: "investor-deck"[\s\S]*visibility: "investor_visible"[\s\S]*requiredScope: "marketing"/);
  for (const key of ["pitch-deck-foundation", "fundraising-readiness", "visual-evidence-qa", "private-demo-room"]) {
    assert.match(assets, new RegExp('key: "' + key + '"[\\s\\S]*visibility: "internal"'));
  }
  assert.match(library, /asset\.key === "investor-deck"/);
  assert.match(library, /\/investor\/marketing\/\$\{inviteToken\}\/deck/);
  assert.doesNotMatch(investorMarketing, /PrivateProductDemoRoom/);
});

test("MKT7 adds a dedicated Investor Deck entry to the Investor Room", () => {
  assert.match(investorAccess, /Investor Deck/);
  assert.match(investorAccess, /14-slide Investor Release/);
  assert.match(investorAccess, /investor\/marketing/);
  assert.match(investorAccess, /deck\?lang=en/);
  assert.match(investorAccess, /access\.scopes\.includes\("marketing"\)/);
});
