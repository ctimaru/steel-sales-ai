import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const card = read("../components/home-network-pro-card.tsx");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const nav = read("../components/workspace-navigation.tsx");

// Run the pure summary helper (imports and JSX stripped) against sample coverage.
const helperSource = card.slice(card.indexOf("export type NetworkProCardStats"), card.indexOf("const startingMonthlyPrice"));
const compiled = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sandbox = { exports: {}, module: { exports: {} } };
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(compiled, sandbox);
const { summarizeNetworkProCoverage } = sandbox.exports;
const country = (countryCode, published, m) => ({
  countryCode, published, classified: published, unclassified: 0, provisional: 0,
  publishedModules: m, provisionalModules: { producers: 0, distributors: 0, processors: 0, end_users: 0 },
});

test("HOME-NETPRO1/2 right rail sells Network PRO instead of listing companies to meet", () => {
  assert.doesNotMatch(home, /loadHomeSuggestedCompanies|HomeSuggestedCompanies/);
  assert.match(home, /\{networkEnabled \? <HomeNetworkProCard entitled=\{networkEntitled\} stats=\{networkProStats\} \/> : null\}/);
  // Real counts are loaded inside the single Promise.all (HP16), only when the Network is enabled.
  assert.match(home, /networkEnabled \? getNetworkProCoverage\(context\.organizationId\) : Promise\.resolve\(null\)/);
  assert.match(home, /const networkProStats = summarizeNetworkProCoverage\(coverage\)/);
});

test("HOME-NETPRO2 stats are summed from real coverage and hidden when unavailable", () => {
  assert.equal(summarizeNetworkProCoverage(null), null);
  assert.equal(summarizeNetworkProCoverage({ countries: [] }), null);
  const stats = summarizeNetworkProCoverage({ countries: [
    country("IT", 100, { producers: 5, distributors: 12, processors: 50, end_users: 8 }),
    country("DE", 20, { producers: 2, distributors: 3, processors: 9, end_users: 1 }),
  ] });
  assert.deepEqual({ ...stats }, { total: 120, italy: 100, countries: 2, producers: 7, distributors: 15, processors: 59, endUsers: 9 });
  assert.match(card, /\{stats \? \(\s*<div data-testid="home-network-pro-stats"/);
});

test("HOME-NETPRO2 card routes locked users to /network/pro and entitled users to the Network", () => {
  assert.match(card, /href=\{entitled \? appRoutes\.network\.directory : appRoutes\.network\.pro\}/);
  assert.match(card, /entitled \? "Apri il Network" : "Passa a Network PRO"/);
  assert.match(card, /data-state=\{entitled \? "entitled" : "locked"\}/);
  // Starting price comes from the same proposed price book as /network/pro, never hard-coded.
  assert.match(card, /NETWORK_PRO_PRICE_BOOK\.IT/);
  assert.doesNotMatch(card, /\b39 €|checkout|"use client"|createClient|fetch\(|dangerouslySetInnerHTML/);
});

test("NAV-BADGES1 navigation badges: PRO on Network, FREE on Commerciale and Scuola, Coming soon on Marketplace", () => {
  assert.match(nav, /icon: "network" as const,\s*locked: !networkEntitled,\s*badge: "pro" as const,/);
  assert.match(nav, /icon: "marketplace" as const,\s*locked: false,\s*badge: "soon" as const,/);
  assert.match(nav, /icon: "commercial" as const,\s*locked: false,\s*badge: "free" as const,/);
  assert.match(nav, /icon: "knowledge" as const,\s*locked: false,\s*badge: "free" as const,/);
  assert.match(nav, /data-testid=\{"nav-" \+ badge \+ "-" \+ itemKey\}/);
  assert.match(nav, /data-testid=\{"nav-soon-" \+ itemKey\}/);
  assert.match(nav, /COMING<br \/>SOON/);
  assert.match(nav, /bg-\[#f2b544\]/);
  assert.match(nav, /Premium, non attivo/);
  assert.doesNotMatch(nav, /pro: true/);
});
