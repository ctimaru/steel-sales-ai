import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const routes = read("../lib/routes.ts");
const groups = read("../lib/commercial-director-navigation.ts");
const shell = read("../components/workspace-commercial-director-shell.tsx");
const appShell = read("../components/app-shell.tsx");
const top = read("../components/workspace-navigation.tsx");

const compiled = ts.transpileModule(
  routes + "\n" + groups.replace(/^import \{ appRoutes \} from "@\/lib\/routes";\s*/u, ""),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const { commercialDirectorGroups, commercialDirectorLinkSelected } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

test("COMM-NAV7 has exactly five sales-director groups with canonical destinations", () => {
  assert.deepEqual(commercialDirectorGroups.map(g => g.label), [
    "La mia scrivania", "Trattative e acquisti", "Clienti e fornitori",
    "Analisi e opportunità", "Strumenti e memoria",
  ]);
  const items = commercialDirectorGroups.flatMap(g => g.items);
  assert.ok(items.length >= 20);
  assert.equal(new Set(items.map(i => i.href)).size, items.length, "No duplicate destination");
  for (const { href } of items) {
    assert.ok(href.startsWith("/"), "Internal navigation only: " + href);
    assert.doesNotMatch(href, /^\/marketplace\/rfq-hub/, "No legacy procurement route");
  }
  for (const href of [
    "/commercial", "/rfq-hub", "/rfq-hub/inbox", "/rfq-hub/distinte",
    "/commercial/companies", "/commercial/analysis", "/commercial/search",
    "/commercial/price-intelligence", "/commercial/assistant",
  ]) {
    assert.ok(items.some(i => i.href === href), "Canonical route missing: " + href);
  }
});

test("COMM-NAV7 resolves active filtered RFQ tabs, detail routes and independent spaces", () => {
  assert.equal(commercialDirectorLinkSelected("/commercial", "/commercial", null), true);
  assert.equal(commercialDirectorLinkSelected("/commercial?view=sent#commercial-worklist", "/commercial", "sent"), true);
  assert.equal(commercialDirectorLinkSelected("/commercial?view=sent#commercial-worklist", "/commercial", "received"), false);
  assert.equal(commercialDirectorLinkSelected("/commercial#commercial-worklist", "/commercial", null), false);
  assert.equal(commercialDirectorLinkSelected("/rfq-hub/distinte", "/rfq-hub/distinte/abc", null), true);
  assert.equal(commercialDirectorLinkSelected("/rfq-hub", "/rfq-hub/distinte/abc", null), false);
  assert.equal(commercialDirectorLinkSelected("/commercial/companies", "/commercial/companies/abc", null), true);
  assert.equal(commercialDirectorLinkSelected("/commercial/analysis", "/commercial/analysis", null), true);
});

test("COMM-NAV7 is lateral on desktop and disclosure-based on mobile; keeps role gates", () => {
  assert.match(shell, /data-testid="commercial-director-sidebar"/);
  assert.match(shell, /data-testid="commercial-director-mobile"/);
  assert.match(shell, /xl:grid-cols-\[214px_minmax\(0,1fr\)\]/);
  assert.match(shell, /<Suspense/);
  assert.match(shell, /<details/);
  assert.match(shell, /aria-current=\{current \? "page" : undefined\}/);
  assert.match(shell, /getWorkspaceNavigationContext\(pathname\)/);
  assert.match(appShell, /<WorkspaceCommercialDirectorShell>\{children\}<\/WorkspaceCommercialDirectorShell>/);
  assert.match(top, /if \(current === "home" \|\| current === "commercial"\) return null/);
  assert.match(appShell, /canWriteWorkspace\(organizationRole\)/);
  assert.doesNotMatch(shell + groups, /createAdminClient|service_role|autoDispatch|issuePurchaseOrder/);
});
