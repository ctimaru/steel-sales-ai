import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const config = fs.readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");
const publicKnowledge = fs.readFileSync(new URL("../app/(public)/knowledge/page.tsx", import.meta.url), "utf8");
const publicKnowledgeLayout = fs.readFileSync(new URL("../app/(public)/knowledge/layout.tsx", import.meta.url), "utf8");
const publicKnowledgeTubes = fs.readFileSync(new URL("../app/(public)/knowledge/tubes/page.tsx", import.meta.url), "utf8");
const privateSteelTool = fs.readFileSync(new URL("../app/(workspace)/company/tools/tubi-norme/page.tsx", import.meta.url), "utf8");

const aliases = [
  "../app/(workspace)/commercial/search/page.tsx",
  "../app/(workspace)/commercial/products/page.tsx",
  "../app/(workspace)/commercial/companies/page.tsx",
  "../app/(workspace)/commercial/assistant/page.tsx",
  "../app/(workspace)/operations/uploads/page.tsx",
  "../app/(workspace)/operations/review/page.tsx",
  "../app/(workspace)/operations/alerts/page.tsx",
  "../app/(workspace)/company/profile/page.tsx",
  "../app/(workspace)/company/data-sources/page.tsx",
  "../app/(workspace)/company/pilot-analytics/page.tsx",
].map((path) => fs.readFileSync(new URL(path, import.meta.url), "utf8"));

test("UX2 freezes canonical route families", () => {
  assert.match(routes, /commercial:/);
  assert.match(routes, /operations:/);
  assert.match(routes, /company:/);
  assert.match(routes, /network:/);
  assert.match(routes, /marketplace:/);
  assert.match(routes, /knowledge:/);
  assert.match(routes, /platform:/);
  for (const route of [
    "/commercial/search",
    "/commercial/products",
    "/commercial/companies",
    "/operations/uploads",
    "/operations/review",
    "/company/profile",
    "/company/data-sources",
    "/network",
    "/marketplace",
    "/knowledge",
    "/knowledge/norme",
    "/knowledge/gradi",
    "/knowledge/tubes",
  ]) assert.ok(routes.includes(route), `missing canonical route ${route}`);
});

test("UX2 Company shell and Home use the canonical space contract", () => {
  assert.match(shell, /appRoutes\.commercial\.products/);
  assert.match(shell, /appRoutes\.commercial\.search/);
  assert.match(shell, /appRoutes\.operations\.uploads/);
  assert.match(shell, /appRoutes\.company\.profile/);
  assert.match(shell, /appRoutes\.marketplace\.home/);
  assert.match(shell, /appRoutes\.knowledge\.home/);
  assert.match(shell, /appRoutes\.knowledge\.standards/);
  assert.match(shell, /appRoutes\.knowledge\.grades/);
  assert.match(shell, /appRoutes\.knowledge\.tubes/);
  assert.match(dashboard, /appRoutes\.commercial\.products/);
  assert.match(dashboard, /appRoutes\.marketplace\.home/);
  assert.match(dashboard, /appRoutes\.knowledge\.home/);
  assert.doesNotMatch(dashboard, /action=\{appRoutes\.commercial\.search\}/);
});

test("UX2 canonical private route modules reuse stable domain pages during cutover", () => {
  for (const source of aliases) assert.match(source, /export \{ default \} from "@\/app\/\(workspace\)\//);
});

test("K1 moves Knowledge to a standalone public route family", () => {
  assert.match(publicKnowledge, /Steel Knowledge/);
  assert.match(publicKnowledgeTubes, /Pesi e dimensioni dei tubi in acciaio/);
  assert.match(publicKnowledgeLayout, /ProductBrand/);
  assert.doesNotMatch(publicKnowledgeLayout, /getWorkspaceContext|requireWorkspace/);
  assert.match(privateSteelTool, /export \{ default \} from "@\/app\/\(workspace\)\/tubi-norme\/page"/);
  assert.match(routes, /tubesStandards: "\/company\/tools\/tubi-norme"/);
});

test("UX2 legacy commercial URLs redirect without permanent browser caching", () => {
  for (const fragment of [
    'source: "/search", destination: "/commercial/search"',
    'source: "/products", destination: "/commercial/products"',
    'source: "/customers", destination: "/commercial/companies"',
    'source: "/uploads", destination: "/operations/uploads"',
    'source: "/review", destination: "/operations/review"',
    'source: "/alerts", destination: "/operations/alerts"',
    'source: "/network/manage", destination: "/company/profile"',
    'source: "/data-sources", destination: "/company/data-sources"',
  ]) assert.ok(config.includes(fragment), `missing redirect ${fragment}`);
  assert.doesNotMatch(config, /source: "\/tubi-norme", destination: "\/knowledge\/tubes"/);
  assert.doesNotMatch(config, /source: "\/company\/tools\/tubi-norme", destination: "\/knowledge\/tubes"/);
  assert.match(config, /permanent: false/);
});

test("UX1.4 canonicalizes normalized commercial deep links", () => {
  const data = fs.readFileSync(new URL("../lib/commercial-data.ts", import.meta.url), "utf8");
  const search = fs.readFileSync(new URL("../components/global-search.tsx", import.meta.url), "utf8");
  assert.match(data, /appRoutes\.commercial\.rfq/);
  assert.match(data, /appRoutes\.commercial\.offer/);
  assert.match(data, /appRoutes\.commercial\.order/);
  assert.match(data, /appRoutes\.commercial\.conversation/);
  assert.match(search, /appRoutes\.commercial\.company/);
  assert.match(search, /appRoutes\.commercial\.product/);
});
