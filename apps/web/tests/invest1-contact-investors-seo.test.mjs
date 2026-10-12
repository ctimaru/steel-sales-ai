import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path,import.meta.url),"utf8");
const contact=read("../components/public-contact-section.tsx");
const social=read("../lib/public-social.ts");
const home=read("../app/page.tsx");
const englishHome=read("../app/en/page.tsx");
const it=read("../app/investitori/page.tsx");
const en=read("../app/en/investors/page.tsx");
const sitemap=read("../app/sitemap.ts");

test("INVEST1: official LinkedIn and email visible in both contact surfaces",()=>{
 assert.match(social,/https:\/\/www\.linkedin\.com\/company\/smart-steel-sales/);
 assert.match(contact,/hello@smartsteelsales\.com/);
 assert.match(contact,/get-in-touch/);
 assert.match(contact,/\/en\/investors/);
 assert.match(contact,/\/investitori/);
 assert.match(home, /<PublicContactSection locale="it"/);
 assert.match(englishHome, /<PublicContactSection locale="en"/);
 for (const text of [home,englishHome]) {
  assert.match(text,/https:\/\/www\.linkedin\.com\/company\/smart-steel-sales/);
  assert.match(text,/hello@smartsteelsales\.com/);
 }
});

test("INVEST1: indexable canonical bilingual investor pages but no publicly hosted plan",()=>{
 assert.match(it,/canonical: absoluteUrl\("\/investitori"\)/);
 assert.match(en,/canonical: absoluteUrl\("\/en\/investors"\)/);
 assert.match(sitemap,/url: absoluteUrl\("\/investitori"\)/);
 assert.match(sitemap,/url: absoluteUrl\("\/en\/investors"\)/);
 for(const page of [it,en]) {
  assert.match(page,/mailto:hello@smartsteelsales\.com/);
  assert.doesNotMatch(page,/href="[^"]*\.pdf"/);
  assert.doesNotMatch(page,/<form\b/);
 }
});
