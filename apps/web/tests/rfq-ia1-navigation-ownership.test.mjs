import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const routeSource = read("../lib/routes.ts");
const iaSource = read("../lib/workspace-information-architecture.ts");
const nav = read("../components/workspace-navigation.tsx");
const shell = read("../components/app-shell.tsx");
const publicDistinta = read("../app/(public)/distinta/page.tsx");
const buyer = read("../components/buyer-distinta-builder.tsx");
const rfqHub = read("../app/(workspace)/marketplace/rfq-hub/page.tsx");
const rfqDetail = read("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");
const market = read("../app/(workspace)/marketplace/page.tsx");

const transpile = (content) => ts.transpileModule(content, { compilerOptions: {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
}}).outputText;
const iaCode = iaSource.replace(/^import \{ appRoutes, legacyRoutes \} from "@\/lib\/routes";\s*/u, "");
const { getWorkspaceNavigationContext: location } = await import(
  "data:text/javascript;base64," +
  Buffer.from(transpile(routeSource) + "\n" + transpile(iaCode)).toString("base64")
);

test("RFQ-IA1 routes private procurement into a first-class primary space", () => {
  const mappings = [
    ["/rfq-hub", "rfq", "rfq:home"],
    ["/rfq-hub/123e4567-e89b-12d3-a456-426614174000", "rfq", "rfq:home"],
    ["/rfq-hub/inbox", "rfq", "rfq:inbox"],
    ["/rfq-hub/suppliers", "rfq", "rfq:suppliers"],
    ["/rfq-hub/intelligence", "rfq", "rfq:intelligence"],
    ["/marketplace/rfq-hub", "rfq", "rfq:home"],
    ["/marketplace/rfq-hub/demo", "rfq", "rfq:home"],
    ["/marketplace/inbox", "rfq", "rfq:inbox"],
    ["/marketplace/suppliers/demo", "rfq", "rfq:suppliers"],
    ["/marketplace/intelligence", "rfq", "rfq:intelligence"],
    ["/marketplace", "marketplace", "marketplace:opportunities"],
    ["/marketplace/requests", "marketplace", "marketplace:requests"],
    ["/marketplace/responses/abc", "marketplace", "marketplace:responses"],
    ["/marketplace/notifications", "marketplace", "marketplace:notifications"],
    ["/commercial/rfqs/example", "commercial", "commercial:search"],
    ["/school", "knowledge", "knowledge:home"],
  ];
  for (const [route, primary, context] of mappings) {
    assert.deepEqual(location(route), { primary, context }, route);
  }
});

test("RFQ-IA1 canonical routes reuse the existing private engine and leave legacy routes available", () => {
  for (const entry of [
    ["../app/(workspace)/rfq-hub/page.tsx", "marketplace/rfq-hub/page"],
    ["../app/(workspace)/rfq-hub/[rfqId]/page.tsx", "marketplace/rfq-hub/[rfqId]/page"],
    ["../app/(workspace)/rfq-hub/inbox/page.tsx", "marketplace/inbox/page"],
    ["../app/(workspace)/rfq-hub/suppliers/page.tsx", "marketplace/suppliers/page"],
    ["../app/(workspace)/rfq-hub/intelligence/page.tsx", "marketplace/intelligence/page"],
  ]) {
    const source = read(entry[0]);
    assert.match(source, /export const dynamic = "force-dynamic"/);
    assert.ok(source.includes(`export { default } from "@/app/(workspace)/${entry[1]}"`));
  }
  assert.match(routeSource, /rfqHub: \{/);
  assert.match(routeSource, /home: "\/rfq-hub"/);
  assert.match(routeSource, /rfqHub: "\/marketplace\/rfq-hub"/);
  assert.match(rfqHub, /appRoutes\.rfqHub\.campaign\(campaign\.id\)/);
  assert.match(rfqDetail, /href=\{appRoutes\.rfqHub\.home\}/);
  assert.match(buyer, /router\.push\(appRoutes\.rfqHub\.campaign\(result\.rfqId\)\)/);
});

test("RFQ-IA1 shows RFQ Hub in primary navigation without a Network subscription", () => {
  assert.match(nav, /key: "rfq" as const/);
  assert.match(nav, /href: appRoutes\.rfqHub\.home/);
  assert.match(nav, /label: "RFQ Hub"/);
  assert.match(nav, /mobileLabel: "RFQ"/);
  assert.match(nav, /current === "rfq"/);
  assert.match(nav, /rfqItems: WorkspaceNavItem\[\]/);
  assert.match(shell, /const rfqItems = visibleItems\(rfqNav, organizationRole\)/);
  assert.match(shell, /rfqItems=\{rfqItems\}/);
  assert.ok(nav.indexOf('key: "rfq" as const') < nav.indexOf('...(networkEnabled'), "RFQ must be independent from Marketplace/Network feature flag");
});

test("RFQ-IA1 distinguishes procurement from Marketplace and preserves viewer access", () => {
  const rfqEntries = shell.slice(shell.indexOf("const rfqNav:"), shell.indexOf("const marketplaceNav:"));
  const marketplaceEntries = shell.slice(shell.indexOf("const marketplaceNav:"), shell.indexOf("const knowledgeNav:"));
  assert.match(rfqEntries, /label: "Le mie RFQ"/);
  assert.match(rfqEntries, /label: "Nuova distinta ↗".*writeRole: true/);
  assert.match(rfqEntries, /label: "Inbox acquisti"/);
  assert.match(rfqEntries, /label: "Fornitori"/);
  assert.doesNotMatch(rfqEntries.match(/label: "Le mie RFQ"[^\n]*/)[0], /writeRole: true/);
  assert.match(rfqEntries.match(/label: "Inbox acquisti"[^\n]*/)[0], /writeRole: true/);
  assert.match(rfqEntries.match(/label: "Fornitori"[^\n]*/)[0], /writeRole: true/);
  assert.match(marketplaceEntries, /label: "Opportunità"/);
  assert.match(marketplaceEntries, /label: "Le mie pubblicazioni"/);
  assert.doesNotMatch(marketplaceEntries, /label: "Acquisti"|label: "RFQ"/);
  assert.match(shell, /\.filter\(\(item\) => canSee\(item, role\)\)/);
});

test("RFQ-IA1 keeps the public SEO tool separate and explicitly links authenticated buyers home", () => {
  assert.match(publicDistinta, /export const metadata/);
  assert.match(publicDistinta, /canonical: absoluteUrl\("\/distinta"\)/);
  assert.match(publicDistinta, /\{authenticated \? \(/);
  assert.match(publicDistinta, /href=\{appRoutes\.rfqHub\.createDistinta\}/);
  assert.match(publicDistinta, /La bozza può essere ripresa nel Workspace/);
  assert.match(market, /href=\{appRoutes\.rfqHub\.home\}/);
  assert.match(market, /Le campagne RFQ riservate e i confronti tra fornitori/);
  assert.match(rfqHub, /Marketplace resta un canale opzionale di pubblicazione/);
});
