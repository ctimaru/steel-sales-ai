import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const data = read("../lib/mkt9-investor-deck-candidate.ts");
const slides = JSON.parse(data.split("export const mkt9DeckSlides = ")[1].split(" as const;")[0]);
const component = read("../components/mkt9-investor-deck-candidate.tsx");
const owner = read("../app/(italian)/(platform)/platform/marketing/investor-deck/page.tsx");
const release = read("../lib/marketing-investor-deck-release.ts");

test("MKT9 candidate has fourteen sequential bilingual evidence-labeled slides", () => {
  assert.deepEqual(slides.map(s => s.number), Array.from({length:14}, (_, i) => i+1));
  for (const s of slides) {
    assert.ok(["fact", "hypothesis", "target"].includes(s.status));
    assert.equal(s.it.cards.length, s.en.cards.length);
    for (const locale of ["it", "en"]) {
      const copy = s[locale];
      assert.ok(copy.title && copy.lead && copy.footer);
      assert.ok(copy.cards.every(c => c.title && c.body));
    }
  }
});
test("MKT9 explicitly distinguishes coverage, price hypotheses, roadmap and funding", () => {
  assert.equal(slides[5].status, "target");
  assert.match(slides[5].it.footer, /non live; non clienti/);
  assert.match(slides[5].en.footer, /not live; not customers/);
  assert.equal(slides[6].status, "hypothesis");
  assert.match(slides[6].it.footer, /non acquistabili/);
  assert.equal(slides[11].status, "target");
  assert.match(slides[11].en.footer, /not operational/);
  assert.equal(slides[13].status, "target");
  for (const locale of ["it", "en"]) {
    assert.equal(slides[13][locale].cards.reduce((n,c) => n + Number(c.body.replace(/[^0-9]/g,"")),0),1000);
  }
});
test("MKT9 is an owner preview; legacy investor release remains unchanged", () => {
  assert.ok(owner.indexOf("await requirePlatformSuperadmin()") >= 0);
  assert.ok(owner.indexOf("await requirePlatformSuperadmin()") < owner.indexOf("<Mkt9InvestorDeckCandidate"));
  assert.match(owner, /<InvestorDeckProduction locale=/);
  assert.match(release, /version: "MKT7-RC1"/);
  assert.match(release, /requiredScope: "marketing"/);
  assert.match(release, /includesPrivateDemoScreenshots: false/);
  assert.doesNotMatch(component, /business-plan-vision-content|investor-outreach|supabase|fetch\(/);
});
test("MKT9 responsive visual uses intrinsic mobile height and labeled progress", () => {
  assert.match(component, /min-w-0/);
  assert.match(component, /sm:grid-cols-2/);
  assert.doesNotMatch(component, /aspect-\[16\/9\]/);
  assert.match(component, /role="progressbar"/);
  assert.match(component, /aria-valuenow=\{2718\}/);
  assert.match(component, /18\.12%/);
  assert.match(component, /Private preview · not released/);
});
