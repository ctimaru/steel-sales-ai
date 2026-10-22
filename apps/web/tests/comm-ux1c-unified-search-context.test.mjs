import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = name => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const context = read("../lib/commercial-search-context.ts");
const server = read("../app/(workspace)/search/actions.ts");
const page = read("../app/(workspace)/search/page.tsx");
const search = read("../components/global-search.tsx");
const nav = read("../components/workspace-navigation.tsx");
const worklist = read("../components/commercial-unified-worklist.tsx");
const customers = read("../app/(workspace)/customers/page.tsx");
const products = read("../app/(workspace)/products/page.tsx");
const routes = read("../lib/routes.ts");
const compiled = ts.transpileModule(context, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const helpers = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

test("COMM-UX1C keeps a finite five-scope vocabulary; malformed query never creates a public search", () => {
  assert.deepEqual(helpers.commercialSearchScopes.map(s => s.value),
    ["all", "activities", "companies", "products", "documents"]);
  assert.equal(helpers.parseCommercialSearchScope("__proto__"), "all");
  assert.equal(helpers.parseCommercialSearchScope("network"), "all");
  assert.equal(helpers.parseCommercialSearchScope(["companies"]), "all");
  assert.equal(helpers.parseCommercialSearchScope("products"), "products");
  assert.deepEqual(helpers.commercialSearchScopeTypes("activities"), ["rfq", "offer", "order", "delivery"]);
  assert.deepEqual(helpers.commercialSearchScopeTypes("companies"), ["company"]);
  assert.deepEqual(helpers.commercialSearchScopeTypes("products"), ["product"]);
  assert.deepEqual(helpers.commercialSearchScopeTypes("documents"), ["document"]);
  assert.deepEqual(helpers.commercialSearchScopeTypes("all"), []);
});

test("COMM-UX1C preserves query and scope in same-origin URLs only", () => {
  const q = " P265GH Ø 406,4 & 6,3 ";
  const url = helpers.commercialSearchHref(q, "products");
  assert.equal(url, "/commercial/search?q=P265GH+%C3%98+406%2C4+%26+6%2C3&scope=products");
  assert.equal(helpers.commercialSearchHref(), "/commercial/search");
  assert.equal(helpers.operationalSearchHref("cliente € 120"), "/commercial?q=cliente+%E2%82%AC+120#commercial-worklist");
  assert.equal(helpers.operationalSearchHref(), "/commercial#commercial-worklist");
  assert.equal(helpers.normalizeCommercialSearchQuery(" x ".repeat(500)).length, 160);
  assert.ok(!url.startsWith("/network"));
});

test("COMM-UX1C confines server action filters even when user form is tampered with", () => {
  assert.match(server, /supabase\.auth\.getClaims\(\)/);
  assert.match(server, /actor_user_id: actorUserId/);
  assert.match(server, /WORKER_INTERNAL_TOKEN/);
  assert.match(server, /parseCommercialSearchScope\(text\(formData, "scope"\)\)/);
  assert.match(server, /commercialSearchScopeTypes\(scope\)/);
  assert.match(server, /matchedTypes\.length \? matchedTypes : restrictedTypes/);
  assert.match(server, /restrictedTypes\.length/);
  assert.match(server, /query\.length > 160/);
  assert.match(server, /cache: "no-store"/);
  assert.match(server, /metadata: \{ surface: "global_search" \}/);
  assert.doesNotMatch(server, /network\.directory|SUPABASE_SERVICE_ROLE_KEY|owner_id:/);
});

test("COMM-UX1C auto-searches only a user-provided query using the existing server action", () => {
  assert.match(search, /useActionState\(globalSearch, initialState\)/);
  assert.match(search, /useRef<string \| null>\(null\)/);
  assert.match(search, /if \(initialQuery\.trim\(\)\.length < 2\) return/);
  assert.match(search, /formData\.set\("query", initialQuery\)/);
  assert.match(search, /formData\.set\("scope", scope\)/);
  assert.match(search, /startTransition\(\(\) => formAction\(formData\)\)/);
  assert.match(search, /<input type="hidden" name="scope" value=\{scope\}/);
  assert.match(search, /state\.status === "success"/);
  assert.match(search, /state\.status === "error"/);
  assert.match(search, /Se esiste un riferimento navigabile/);
  assert.match(search, /app-primary/);
});

test("COMM-UX1C makes commercial memory and procurement two explicit, linked search contexts", () => {
  assert.match(page, /Categorie ricerca commerciale/);
  const css = read("../app/globals.css");
  assert.match(css, /nav\[aria-label="Categorie ricerca commerciale"\] a\[aria-current="page"\]/);
  assert.match(css, /-webkit-text-fill-color: #ffffff !important/);
  assert.match(page, /commercialSearchScopes\.map/);
  assert.match(page, /commercialSearchHref\(initialQuery, entry\.value\)/);
  assert.match(page, /operationalSearchHref\(initialQuery\)/);
  assert.match(page, /memoria commerciale privata/);
  assert.match(page, /non vengono associate automaticamente al CRM/);
  assert.match(worklist, /commercialSearchHref\(query\)/);
  assert.match(worklist, /Qui filtri le attività visibili/);
  assert.match(customers, /commercialSearchHref\(query, "companies"\)/);
  assert.match(products, /commercialSearchHref\(query, "products"\)/);
  assert.match(nav, /action=\{appRoutes\.commercial\.search\}/);
  assert.match(nav, /name="q"/);
  assert.match(routes, /search: "\/commercial\/search"/);
  assert.doesNotMatch(page, /createAdminClient|service_role|\/network\/.+fetch/i);
});
