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
const analysisHub = read("../app/(italian)/(workspace)/commercial/analysis/page.tsx");
const nav = read("../components/workspace-navigation.tsx");
const platformNav = read("../components/platform-navigation.tsx");
const commercialHome = read("../app/(workspace)/commercial/page.tsx");
const schoolHome = read("../app/(workspace)/school/page.tsx");

const canonicalWrappers = [
  "../app/(workspace)/commercial/explorer/page.tsx",
  "../app/(workspace)/commercial/price-intelligence/page.tsx",
  "../app/(workspace)/commercial/market-intelligence/page.tsx",
].map(read);
const schoolExplorer = read("../app/(workspace)/school/explorer/page.tsx");

test("HP10 gives daily tools canonical routes inside their product space", () => {
  assert.match(routes, /explorer: "\/commercial\/explorer"/);
  assert.match(routes, /priceIntelligence: "\/commercial\/price-intelligence"/);
  assert.match(routes, /marketIntelligence: "\/commercial\/market-intelligence"/);
  assert.match(routes, /explorer: "\/school\/explorer"/);
  assert.match(routes, /knowledgeExplorer: "\/commercial\/knowledge"/);

  for (const wrapper of canonicalWrappers) {
    assert.match(wrapper, /export \{ default \} from/);
  }
  // School's canonical route now provides a language-aware wrapper while
  // preserving the identical authorized KnowledgeExplorer server action.
  assert.match(schoolExplorer, /redirect\(appRoutes\.commercial\.knowledgeExplorer\)/);
  assert.match(read("../app/(workspace)/commercial/knowledge/page.tsx"), /KnowledgeExplorer locale="it"/);
  assert.match(read("../app/(workspace)/commercial/knowledge/page.tsx"), /force-dynamic/);
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

  assert.match(analysisHub, /appRoutes\.commercial\.explorer/);
  assert.match(analysisHub, /appRoutes\.commercial\.priceIntelligence/);
  assert.match(analysisHub, /appRoutes\.commercial\.marketIntelligence/);
  assert.doesNotMatch(shell.slice(shell.indexOf("const knowledgeNav"),shell.indexOf("function roleLabel")),/Documenti|knowledge\.explorer/);
  assert.doesNotMatch(schoolHome,/knowledge\.explorer|school-private-documents/);
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
  assert.match(nav, /current === "home" \|\| current === "commercial"/);
  assert.match(nav, /selectedCommercialArea === item.contextKey/);
});

test("HP10 gives Commerciale a real contextual home and complete intelligence entry points", () => {
  assert.match(shell, /contextKey: "commercial:home"/);
  assert.match(shell, /label: "Relazioni", contextKey: "commercial:companies"/);
  assert.match(shell, /label: "Analisi", contextKey: "commercial:analysis"/);
  for (const key of ["commercial:search", "commercial:products", "commercial:assistant", "commercial:intelligence:explorer", "commercial:intelligence:prices", "commercial:intelligence:market", "commercial:intelligence:relationships"]) {
    assert.ok(ia.includes(key), key);
  }
  assert.match(analysisHub, /appRoutes\.commercial\.crossThreadRelationships/);
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
  assert.match(shell, /label: "Professore"/);
  assert.match(shell, /label: "Norme"/);
  assert.match(shell, /label: "Materiali"/);
  assert.match(shell, /label: "Guide"/);
  assert.doesNotMatch(shell.slice(shell.indexOf("const knowledgeNav"),shell.indexOf("function roleLabel")), /Documenti/);
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
