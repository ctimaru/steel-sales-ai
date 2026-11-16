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
const { commercialDirectorGroups, commercialDirectorAllItems, commercialDirectorLinkSelected } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

test("OFFICE-PROFILES1 exposes Direzione aziendale with the two offices while retaining canonical destinations", () => {
  assert.deepEqual(commercialDirectorGroups.map(g => g.label), [
    "Scrivania", "Direzione aziendale", "Analisi", "Strumenti",
  ]);
  const direction = commercialDirectorGroups.find(g => g.key === "direction");
  assert.deepEqual(direction.sections.map(section => section.label), ["Ufficio commerciale", "Ufficio acquisti"]);
  assert.deepEqual(direction.items.filter(item => item.adminOnly).map(item => item.label), ["Team e profili"],
    "Only the profile management entry is reserved to the Direzione");
  assert.ok(direction.sections.every(section => section.items.every(item => !item.adminOnly)),
    "Each office stays visible to the other one");
  const primary = commercialDirectorGroups.flatMap(g => [...g.items, ...(g.sections ?? []).flatMap(section => section.items)]);
  const items = commercialDirectorGroups.flatMap(commercialDirectorAllItems);
  assert.equal(primary.length, 14, "Only 14 immediate destinations");
  assert.equal(items.length, 20, "Less-used destinations remain under disclosure");
  assert.ok(commercialDirectorGroups.every(g => "moreItems" in g));
  assert.ok(!items.some(i => i.href.includes("#commercial-today")));
  assert.ok(!items.some(i => i.href.includes("?view=sent") || i.href.includes("?view=received")
    || i.href.includes("?view=offers") || i.href.includes("?view=orders")));
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
  assert.equal(commercialDirectorLinkSelected("/commercial?view=all#commercial-worklist", "/commercial", "sent"), true);
  assert.equal(commercialDirectorLinkSelected("/commercial?view=all#commercial-worklist", "/commercial", "received"), true);
  assert.equal(commercialDirectorLinkSelected("/commercial?view=all#commercial-worklist", "/commercial", null), false);
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
  assert.match(appShell, /<WorkspaceCommercialDirectorShell role=\{organizationRole\} businessRole=\{businessRole\}>/);
  assert.match(top, /if \(current === "home" \|\| current === "commercial"\) return null/);
  assert.match(appShell, /canWriteWorkspace\(role\)/);
  assert.doesNotMatch(shell + groups, /createAdminClient|service_role|autoDispatch|issuePurchaseOrder/);
});

test("COMM-NAV8 keeps a single director destination on deal details and legacy bookmarks", () => {
  const selected = (pathname, view = null) => commercialDirectorGroups
    .flatMap(commercialDirectorAllItems)
    .filter(item => commercialDirectorLinkSelected(item.href, pathname, view))
    .map(item => item.label);

  assert.deepEqual(selected("/commercial/offers/offer-1"), ["Trattative"]);
  assert.deepEqual(selected("/offers/offer-1"), ["Trattative"]);
  assert.deepEqual(selected("/commercial/orders/order-1"), ["Trattative"]);
  assert.deepEqual(selected("/orders/order-1"), ["Trattative"]);
  assert.deepEqual(selected("/commercial/rfqs/request-1"), ["RFQ e conversazioni"]);
  assert.deepEqual(selected("/rfqs/request-1"), ["RFQ e conversazioni"]);
  assert.deepEqual(selected("/commercial/conversations/thread-1"), ["Inbox e risposte"]);
  assert.deepEqual(selected("/conversations/thread-1"), ["Inbox e risposte"]);
  assert.deepEqual(selected("/rfq-hub/campaign-1"), ["RFQ e conversazioni"]);
  assert.deepEqual(selected("/rfq-hub/intelligence"), ["RFQ e conversazioni"]);
  assert.deepEqual(selected("/rfq-hub/distinta"), ["RFQ e conversazioni"]);
  assert.deepEqual(selected("/rfq-hub/inbox"), ["Inbox e risposte"]);
  assert.deepEqual(selected("/rfq-hub/suppliers/abc"), ["Fornitori RFQ"]);
  assert.deepEqual(selected("/rfq-hub/distinte/abc"), ["Distinte"]);
  assert.deepEqual(selected("/commercial?not-a-real-path"), [], "No accidental substring matching");
  assert.deepEqual(selected("/commercial", "offers"), ["Trattative"]);
  assert.deepEqual(selected("/commercial", "orders"), ["Trattative"]);
  assert.deepEqual(selected("/commercial", "drafts"), ["Trattative"]);
  assert.deepEqual(selected("/commercial", "received"), ["Trattative"]);
  assert.deepEqual(selected("/commercial", "sent"), ["Trattative"]);
  assert.deepEqual(selected("/commercial"), ["Scrivania"]);
  assert.deepEqual(selected("/commercial/knowledge"), ["Memoria documentale"]);
  assert.deepEqual(selected("/commercial/market-intelligence"), ["Mercato"]);
});

test("COMM-NAV8 mobile section closes after selection and preserves disclosure choices", () => {
  assert.match(shell, /onClick=\{onNavigate\}/, "Anchor links must also dismiss mobile disclosure");
  assert.match(shell, /onNavigate=\{\(\) => setMobileOpen\(false\)\}/);
  assert.match(shell, /onToggle=\{event => setMobileOpen\(event.currentTarget.open\)\}/);
  assert.match(shell, /setMobileOpen\(false\); \}, \[pathname, view\]/);
  assert.match(shell, /Attuale: \{selectedLabel\}/, "Current location is visible before opening the menu");
  assert.match(shell, /<DirectorGroup key=\{group.key\}/, "Do not remount accordions on every filter change");
  assert.match(shell, /onExpandedChange=\{open => setExpandedKey/, "Only one top-level group expands");
  assert.match(shell, /commercialDirectorAllItems\(group\)/, "Secondary links count for active selection");
  assert.match(shell, /Altre funzioni/, "Secondary functions remain discoverable");
  assert.match(shell, /if \(extraActive\) setExtraOpen\(true\)/, "Deep links reveal their active secondary entry");
  assert.doesNotMatch(shell, /group.key \+ ":" \+ pathname/, "Preserve user expansion choices");
});
