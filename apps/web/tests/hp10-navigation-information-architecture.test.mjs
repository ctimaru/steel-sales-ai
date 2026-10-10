import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const platformIa = fs.readFileSync(new URL("../lib/platform-ia-contract.ts", import.meta.url), "utf8");

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const routes = read("../lib/routes.ts");
const ia = read("../lib/workspace-information-architecture.ts");
const shell = read("../components/app-shell.tsx");
const nav = read("../components/workspace-navigation.tsx");
const platformNav = read("../components/platform-navigation.tsx");
const commercialHome = read("../app/(workspace)/commercial/page.tsx");
const schoolHome = read("../app/(workspace)/school/page.tsx");

const canonicalWrappers = [
  "../app/(workspace)/commercial/explorer/page.tsx",
  "../app/(workspace)/commercial/price-intelligence/page.tsx",
  "../app/(workspace)/commercial/market-intelligence/page.tsx",
  "../app/(workspace)/school/explorer/page.tsx",
].map(read);

test("HP10 gives daily tools canonical routes inside their product space", () => {
  assert.match(routes, /explorer: "\/commercial\/explorer"/);
  assert.match(routes, /priceIntelligence: "\/commercial\/price-intelligence"/);
  assert.match(routes, /marketIntelligence: "\/commercial\/market-intelligence"/);
  assert.match(routes, /explorer: "\/school\/explorer"/);
  assert.match(routes, /knowledgeExplorer: "\/school\/explorer"/);

  for (const wrapper of canonicalWrappers) {
    assert.match(wrapper, /export \{ default \} from/);
  }
});

test("HP10 keeps legacy route aliases explicit instead of using them as primary navigation", () => {
  for (const alias of [
    'explorer: "/explorer"',
    'priceIntelligence: "/price-intelligence"',
    'marketIntelligence: "/market-intelligence"',
    'knowledgeExplorer: "/knowledge-explorer"',
  ]) {
    assert.ok(routes.includes(alias), "missing legacy alias " + alias);
  }

  assert.match(shell, /appRoutes\.commercial\.explorer/);
  assert.match(shell, /appRoutes\.commercial\.priceIntelligence/);
  assert.match(shell, /appRoutes\.commercial\.marketIntelligence/);
  assert.match(shell, /appRoutes\.knowledge\.explorer/);
  assert.match(schoolHome, /appRoutes\.knowledge\.explorer/);
});

test("HP10 centralizes route-to-context resolution so root tabs do not double-select", () => {
  assert.match(ia, /export function getWorkspaceNavigationContext/);
  assert.match(ia, /networkContext/);
  assert.match(ia, /marketplaceContext/);
  assert.match(ia, /knowledgeContext/);
  assert.match(ia, /commercialContext/);
  assert.match(ia, /commercial:intelligence:explorer/);

  assert.match(nav, /navigation\.context === item\.contextKey/);
  assert.doesNotMatch(nav, /pathname === href \|\| pathname\.startsWith\(href \+ "\/"\)/);
  assert.match(nav, /intelligenceSelected/);
  assert.match(nav, /aria-current=\{intelligenceSelected \? "page"/);
});

test("HP10 gives Commerciale a real contextual home and complete intelligence entry points", () => {
  assert.match(shell, /contextKey: "commercial:home"/);
  assert.match(shell, /contextKey: "commercial:search"/);
  assert.match(shell, /contextKey: "commercial:products"/);
  assert.match(shell, /contextKey: "commercial:companies"/);
  assert.match(shell, /contextKey: "commercial:assistant"/);
  assert.match(shell, /contextKey: "commercial:intelligence:explorer"/);
  assert.match(shell, /commercial:intelligence:prices/);
  assert.match(shell, /commercial:intelligence:market/);
  assert.match(shell, /commercial:intelligence:relationships/);
  assert.match(commercialHome, /Relazioni cross-thread/);
});

test("HP10 maps dynamic Network and Marketplace detail routes to their parent context", () => {
  assert.match(ia, /return "network:directory"/);
  assert.match(ia, /segments\[0\] === "marketplace" && segments\.length === 2/);
  assert.match(ia, /return "marketplace:requests"/);
  assert.match(ia, /"\/marketplace\/opportunities"/);
  assert.match(ia, /return "marketplace:responses"/);
});

test("HP10 keeps Scuola private navigation separate from public Steel Knowledge", () => {
  assert.match(ia, /primary: "knowledge"/);
  assert.match(ia, /knowledge:explorer/);
  assert.match(ia, /knowledge:catalog/);
  assert.match(ia, /knowledge:standards/);
  assert.match(ia, /knowledge:grades/);
  assert.match(ia, /knowledge:tubes/);
  assert.match(shell, /label: "Calcolo pesi"/);
  assert.match(shell, /label: "Norme"/);
  assert.match(shell, /label: "Gradi"/);
  assert.match(shell, /label: "Documenti"/);
});

test("HP10 groups Platform navigation identically across desktop and mobile", () => {
  for (const label of ["Centro di controllo","Aziende e accessi","Network e fiducia","Contenuti e laboratorio","Analytics e attivazione","Strategia e investitori"]) {
    assert.ok(platformIa.includes(label), "missing Platform group " + label);
  }
  assert.match(platformNav, /getPlatformIaVisibleModules/);
  assert.match(platformNav, /PLATFORM_IA_AREAS\.map/);
  assert.match(platformNav, /aria-label=\{mobile \? "Navigazione mobile Platform"/);
});

test("HP10 preserves the five LinkedIn-style macro destinations on desktop and mobile", () => {
  for (const label of ["Home", "Commerciale", "Network", "Marketplace", "Scuola"]) {
    assert.match(nav, new RegExp('label: "' + label + '"'));
  }
  assert.match(nav, /WorkspaceDesktopPrimaryNavigation/);
  assert.match(nav, /WorkspaceMobileBottomNavigation/);
});
