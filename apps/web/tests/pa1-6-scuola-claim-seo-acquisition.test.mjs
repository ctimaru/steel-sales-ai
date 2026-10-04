import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const schoolLayout = fs.readFileSync(
  new URL("../app/(public)/knowledge/layout.tsx", import.meta.url),
  "utf8",
);
const schoolHome = fs.readFileSync(
  new URL("../app/(public)/knowledge/page.tsx", import.meta.url),
  "utf8",
);
const companyPage = fs.readFileSync(
  new URL("../app/(public)/azienda/page.tsx", import.meta.url),
  "utf8",
);
const claimCta = fs.readFileSync(
  new URL("../components/school-claim-cta.tsx", import.meta.url),
  "utf8",
);
const lookup = fs.readFileSync(
  new URL("../components/public-company-lookup.tsx", import.meta.url),
  "utf8",
);
const lookupActions = fs.readFileSync(
  new URL("../app/public-company-lookup-actions.ts", import.meta.url),
  "utf8",
);
const sitemap = fs.readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const robots = fs.readFileSync(new URL("../app/robots.ts", import.meta.url), "utf8");
const standards = fs.readFileSync(
  new URL("../app/(public)/knowledge/norme/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const grades = fs.readFileSync(
  new URL("../app/(public)/knowledge/gradi/[slug]/page.tsx", import.meta.url),
  "utf8",
);

test("PA1.6 gives every Scuola page a direct company lookup and claim path", () => {
  assert.match(schoolLayout, /<SchoolClaimCta \/>/);
  assert.match(claimCta, /href="\/azienda"/);
  assert.match(claimCta, /Dalla Scuola alla tua azienda/);
  assert.match(claimCta, /il Network[\s\S]*resta privato/i);
  assert.match(schoolLayout, /href="\/azienda"/);
});

test("PA1.6 ships one indexable canonical company acquisition landing, not a public directory", () => {
  assert.match(companyPage, /<PublicCompanyLookup \/>/);
  assert.match(companyPage, /canonical: absoluteUrl\("\/azienda"\)/);
  assert.match(companyPage, /robots: publicIndexRobots/);
  assert.match(companyPage, /Non è una directory/);
  assert.doesNotMatch(companyPage, /href="\/network/);
  assert.match(sitemap, /url: absoluteUrl\("\/azienda"\)/);
  assert.match(robots, /"\/azienda"/);
});

test("PA1.6 preserves the governed PA1.2 minimal lookup and PA1.4 claim handoff", () => {
  assert.match(lookup, /\/register\?claim_ref=/);
  assert.match(lookupActions, /pa1_2_company_lookup/);
  for (const forbidden of [
    "products",
    "capabilities",
    "markets",
    "contacts",
    "website_url",
    "description",
  ]) {
    assert.doesNotMatch(lookupActions, new RegExp(forbidden));
  }
});

test("PA1.6 normalizes visible public knowledge branding to Scuola without changing canonical URLs", () => {
  assert.match(schoolLayout, /default: "Scuola"/);
  assert.match(schoolLayout, /template: "%s · Scuola · Smart Steel Sales"/);
  assert.match(schoolHome, /La Scuola di Smart Steel Sales/);
  assert.doesNotMatch(schoolLayout, />Knowledge</);
  assert.match(standards, />Scuola<\/Link>/);
  assert.match(grades, />Scuola<\/Link>/);
});

test("PA1.6 adds truthful supported structured data around the acquisition path", () => {
  assert.match(home, /"@type": "Organization"/);
  assert.match(home, /"@type": "WebSite"/);
  assert.match(companyPage, /"@type": "BreadcrumbList"/);
  assert.match(standards, /"@type": "BreadcrumbList"/);
  assert.match(grades, /"@type": "BreadcrumbList"/);
});

test("PA1.6 keeps the home acquisition CTA on the governed company route", () => {
  assert.match(home, /href="\/azienda"/);
  assert.match(home, /Trova o rivendica la tua azienda/);
});
