import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const nav = read("../components/workspace-navigation.tsx");
const ia = read("../lib/workspace-information-architecture.ts");
const shell = read("../components/app-shell.tsx");
const commercial = read("../app/(italian)/(workspace)/commercial/page.tsx");
const dashboard = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const routes = read("../lib/routes.ts");

test("COMMERCIAL-UNIFY1 shows one primary Commerciale destination on desktop and mobile", () => {
  const primary = nav.slice(nav.indexOf("function primaryItems("), nav.indexOf("export function WorkspaceDesktopPrimaryNavigation("));
  assert.match(primary, /key: "commercial" as const/);
  assert.doesNotMatch(primary, /key: "rfq" as const/);
  assert.match(primary, /label: "Commerciale"/);
  assert.match(shell, /label: "RFQ e offerte", contextKey: "rfq:home"/);
  assert.match(nav, /item.contextKey === "rfq:home"/);
  assert.match(nav, /navigation.context\?\.startsWith\("rfq:"\)/);
});

test("COMMERCIAL-UNIFY1 retains deep links but resolves private procurement within Commerciale", () => {
  assert.match(ia, /return \{ primary: "commercial", context: rfqContext\(pathname\) \}/);
  assert.match(routes, /home: "\/rfq-hub"/);
  assert.match(routes, /campaign: \(id: string\) => `\/rfq-hub\/\$\{id\}`/);
  assert.match(ia, /appRoutes\.marketplace\.procurementInbox/);
  assert.match(ia, /appRoutes\.marketplace\.rfqHub/);
  assert.match(ia, /primary: "marketplace"/);
});

test("COMMERCIAL-UNIFY1 puts workflow, live buyer actions and Network entry before historical drilldowns", () => {
  assert.match(commercial, /Tutto il lavoro commerciale, in un unico posto/);
  assert.match(commercial, /Che cosa vuoi fare oggi\?/);
  assert.ok(commercial.indexOf('aria-labelledby="commercial-today"') < commercial.indexOf("Cerca nella Commercial Memory"));
  assert.match(commercial, /rfqh10_procurement_inbox/);
  assert.match(commercial, /item\.requires_action === true/);
  assert.match(commercial, /Priorità non disponibili al momento/);
  assert.match(commercial, /\?compose=1#commercial-compose/);
  assert.match(commercial, /appRoutes\.commercial\.home/);
  assert.match(commercial, /appRoutes\.network\.directory/);
  assert.match(commercial, /canWriteWorkspace\(context\.role\)/);
  assert.match(dashboard, /title: "Gestisci richieste e offerte"/);
  assert.match(dashboard, /href: appRoutes\.commercial\.home/);
});

test("COMMERCIAL-UNIFY1 does not promote the private buyer target or review QA as commercial priorities", () => {
  assert.doesNotMatch(commercial, /metrics\.reviewFlags|Target buyer/);
  assert.match(commercial, /non condividono automaticamente prezzi, contatti o documenti/);
  assert.match(commercial, /typeof procurementPayload\?\.summary\?\.active_rfqs === "number"/);
});
