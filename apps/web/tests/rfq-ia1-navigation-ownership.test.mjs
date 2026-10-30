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

test("COMMERCIAL-UNIFY1 places private procurement inside Commerciale while retaining RFQ contexts", () => {
  const mappings = [
    ["/rfq-hub", "commercial", "rfq:home"],
    ["/rfq-hub/123e4567-e89b-12d3-a456-426614174000", "commercial", "rfq:home"],
    ["/rfq-hub/inbox", "commercial", "rfq:inbox"],
    ["/rfq-hub/suppliers", "commercial", "rfq:suppliers"],
    ["/rfq-hub/intelligence", "commercial", "rfq:intelligence"],
    ["/marketplace/rfq-hub", "commercial", "rfq:home"],
    ["/marketplace/rfq-hub/demo", "commercial", "rfq:home"],
    ["/marketplace/inbox", "commercial", "rfq:inbox"],
    ["/marketplace/suppliers/demo", "commercial", "rfq:suppliers"],
    ["/marketplace/intelligence", "commercial", "rfq:intelligence"],
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

test("COMMERCIAL-UNIFY1 exposes procurement under Commerciale independently of Network access", () => {
  const primary = nav.slice(nav.indexOf("function primaryItems("), nav.indexOf("export function WorkspaceDesktopPrimaryNavigation("));
  assert.match(primary, /key: "commercial" as const/);
  assert.doesNotMatch(primary, /key: "rfq" as const/);
  assert.match(shell, /label: "Attività", contextKey: "commercial:home"/);
  assert.doesNotMatch(shell, /label: "RFQ e offerte"/);
  assert.match(nav, /current === "home" \|\| current === "commercial"/);
  assert.ok(primary.indexOf('key: "commercial" as const') < primary.indexOf('...(networkEnabled'), "Commerciale must not depend on Network entitlement");
});

test("RFQ-IA1 distinguishes procurement from Marketplace while keeping authorized deep links", () => {
  const menu = shell.slice(shell.indexOf("const commercialNav:"), shell.indexOf("const networkNav:"));
  const marketplaceEntries = shell.slice(shell.indexOf("const marketplaceNav:"), shell.indexOf("const knowledgeNav:"));
  assert.equal((menu.match(/contextKey:/g) || []).length, 3);
  assert.match(menu, /label: "Attività"/);
  assert.match(routeSource, /home: "\/rfq-hub"/);
  assert.match(routeSource, /savedDistinte: "\/rfq-hub\/distinte"/);
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
