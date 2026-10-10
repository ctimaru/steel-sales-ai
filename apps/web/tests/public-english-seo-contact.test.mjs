import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/page.tsx");
const englishHome = read("../app/en/page.tsx");
const englishKnowledge = read("../app/en/knowledge/page.tsx");
const englishNetwork = read("../app/en/network/page.tsx");
const sitemap = read("../app/sitemap.ts");
const robots = read("../app/robots.ts");
const contact = read("../components/public-contact-section.tsx");
const social = read("../lib/public-social.ts");

test("Italian and English homepages expose bidirectional language alternates", () => {
  assert.match(home, /canonical: absoluteUrl\("\/"\)/);
  assert.match(home, /en: absoluteUrl\("\/en"\)/);
  assert.match(englishHome, /canonical: absoluteUrl\("\/en"\)/);
  assert.match(englishHome, /it: absoluteUrl\("\/"\)/);
  assert.match(englishHome, /lang="en"/);
});

test("English knowledge and network pages are independently indexable", () => {
  assert.match(englishKnowledge, /canonical: absoluteUrl\("\/en\/knowledge"\)/);
  assert.match(englishKnowledge, /it: absoluteUrl\("\/knowledge"\)/);
  assert.match(englishNetwork, /canonical: absoluteUrl\("\/en\/network"\)/);
  assert.match(sitemap, /url: absoluteUrl\("\/en"\)/);
  assert.match(sitemap, /url: absoluteUrl\("\/en\/knowledge"\)/);
  assert.match(sitemap, /url: absoluteUrl\("\/en\/network"\)/);
  assert.match(robots, /allow: \["\\/", "\\/azienda", "\\/knowledge", "\\/knowledge\\/"\]/);
  assert.doesNotMatch(robots, /disallow: \[[\s\S]*?"\\/en"/);
});

test("Contact is present on both homes without inventing a LinkedIn message URL", () => {
  assert.match(home, /<PublicContactSection locale="it" \/>/);
  assert.match(englishHome, /<PublicContactSection locale="en" \/>/);
  assert.match(contact, /getLinkedInCompanyUrl/);
  assert.match(contact, /get-in-touch/);
  assert.match(contact, /LinkedIn company page coming soon/);
  assert.doesNotMatch(contact, /linkedin\.com\/messaging\/compose/);
  assert.match(social, /NEXT_PUBLIC_LINKEDIN_COMPANY_URL/);
  assert.match(social, /linkedin\.com/);
  assert.match(social, /url\.protocol !== "https:"/);
});
