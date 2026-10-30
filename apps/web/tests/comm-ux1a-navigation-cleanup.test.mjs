import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const shell = read("../components/app-shell.tsx");
const nav = read("../components/workspace-navigation.tsx");
const directorShell = read("../components/workspace-commercial-director-shell.tsx");
const directorGroups = read("../lib/commercial-director-navigation.ts");
const routes = read("../lib/routes.ts");
const ia = read("../lib/workspace-information-architecture.ts");
const commercial = read("../app/(italian)/(workspace)/commercial/page.tsx");
const analysis = read("../app/(italian)/(workspace)/commercial/analysis/page.tsx");

const transpile = (source) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
}}).outputText;
const iaSource = ia.replace(/^import \{ appRoutes, legacyRoutes \} from "@\/lib\/routes";\s*/u, "");
const { getWorkspaceNavigationContext, getCommercialNavigationArea } = await import(
  "data:text/javascript;base64," +
  Buffer.from(transpile(routes) + "\n" + transpile(iaSource)).toString("base64")
);

test("COMM-NAV7 uses grouped director navigation instead of duplicated Commerciale top tabs", () => {
  assert.match(shell, /<WorkspaceCommercialDirectorShell>\{children\}<\/WorkspaceCommercialDirectorShell>/);
  assert.match(nav, /if \(current === "home" \|\| current === "commercial"\) return null/);
  assert.match(directorShell, /aria-label="Menu Commerciale"/);
  assert.match(directorShell, /aria-label="Menu Commerciale mobile"/);
  assert.match(directorShell, /getWorkspaceNavigationContext\(pathname\)\.primary !== "commercial"/);
  assert.match(directorShell, /xl:grid-cols-\[214px_minmax\(0,1fr\)\]/);
  for (const title of [
    "La mia scrivania", "Trattative e acquisti", "Clienti e fornitori",
    "Analisi e opportunità", "Strumenti e memoria",
  ]) assert.ok(directorGroups.includes(title), title);
  assert.match(directorShell, /aria-current=\{current \? "page" : undefined\}/);
  assert.match(nav, /WorkspaceMobileBottomNavigation/);
});

test("COMM-UX1A keeps RFQ deep links in Attività and differentiates areas", () => {
  const examples = [
    ["/commercial", "commercial:home"],
    ["/commercial/search", "commercial:home"],
    ["/commercial/assistant", "commercial:home"],
    ["/commercial/rfqs/123", "commercial:home"],
    ["/rfq-hub", "commercial:home"],
    ["/rfq-hub/inbox", "commercial:home"],
    ["/rfq-hub/distinte/123", "commercial:home"],
    ["/marketplace/rfq-hub/123", "commercial:home"],
    ["/commercial/companies", "commercial:companies"],
    ["/commercial/companies/123", "commercial:companies"],
    ["/commercial/conversion/relationships", "commercial:companies"],
    ["/commercial/analysis", "commercial:analysis"],
    ["/commercial/products/123", "commercial:analysis"],
    ["/commercial/price-intelligence", "commercial:analysis"],
    ["/commercial/market-intelligence", "commercial:analysis"],
    ["/commercial/demand", "commercial:analysis"],
  ];
  for (const [path, area] of examples) {
    const resolved = getWorkspaceNavigationContext(path);
    assert.equal(resolved.primary, "commercial", path);
    assert.equal(getCommercialNavigationArea(resolved.context), area, path);
  }
  assert.equal(getWorkspaceNavigationContext("/marketplace").primary, "marketplace");
  assert.equal(getWorkspaceNavigationContext("/school").primary, "knowledge");
});

test("COMM-UX1A retains specialist engines without creating a second RFQ implementation", () => {
  assert.match(routes, /analysis: "\/commercial\/analysis"/);
  assert.match(routes, /home: "\/rfq-hub"/);
  assert.match(routes, /savedDistinte: "\/rfq-hub\/distinte"/);
  assert.match(commercial, /CommercialUnifiedWorklist/);
  assert.match(commercial, /BuyerDistintaBuilder/);
  assert.match(commercial, /Memoria commerciale e storico/);
  assert.match(commercial, /Strumenti e intelligence avanzata/);
  for (const name of [
    "priceIntelligence", "products", "marketIntelligence", "explorer",
    "demand", "reengagement", "conversion", "crossThreadRelationships",
  ]) assert.ok(analysis.includes("appRoutes.commercial." + name), name);
  assert.doesNotMatch(analysis, /createAdminClient|service_role|autoDispatch|publishMarketplace/);
});

test("COMM-UX1A keeps header search and Commerciale role-aware gates", () => {
  assert.match(nav, /action=\{appRoutes.commercial.search\}/);
  assert.match(shell, /canWriteWorkspace\(organizationRole\)|canWriteWorkspace\(role\)/);
  assert.match(commercial, /canWriteWorkspace\(context.role\)/);
});
