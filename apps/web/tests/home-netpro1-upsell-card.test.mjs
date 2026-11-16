import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const card = read("../components/home-network-pro-card.tsx");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");

test("HOME-NETPRO1 right rail sells Network PRO instead of listing companies to meet", () => {
  assert.doesNotMatch(home, /loadHomeSuggestedCompanies|HomeSuggestedCompanies/);
  assert.match(home, /\{networkEnabled \? <HomeNetworkProCard entitled=\{networkEntitled\} italyPublished=\{italyPublished\} \/> : null\}/);
  // The published count is only loaded for locked organizations, inside the single Promise.all.
  assert.match(home, /networkEnabled && !networkEntitled \? getNetworkProCoverage\(context\.organizationId\) : Promise\.resolve\(null\)/);
  assert.match(home, /country\.countryCode === "IT"\)\?\.published \?\? null/);
});

test("HOME-NETPRO1 card routes locked users to the existing PRO page and entitled users to the Network", () => {
  assert.match(card, /href=\{entitled \? appRoutes\.network\.directory : appRoutes\.network\.pro\}/);
  assert.match(card, /entitled \? "Cerca nel Network" : "Sblocca il Network"/);
  assert.match(card, /data-state=\{entitled \? "entitled" : "locked"\}/);
});

test("HOME-NETPRO1 card never invents matches, names, prices or checkout", () => {
  // Only a real, positive integer count is shown; otherwise the copy has no number.
  assert.match(card, /Number\.isSafeInteger\(italyPublished\) && italyPublished > 0/);
  assert.match(card, /Esempio di richiesta/);
  // Locked rows are aria-hidden skeletons, not company names.
  assert.match(card, /<div aria-hidden="true" className="space-y-2">/);
  assert.doesNotMatch(card, /S\.r\.l\.|S\.p\.A\.|€|checkout|fornitori compatibili/i);
  assert.doesNotMatch(card, /"use client"|createClient|fetch\(|dangerouslySetInnerHTML/);
});
