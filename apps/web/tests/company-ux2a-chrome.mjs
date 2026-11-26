/**
 * COMPANY-UX2.A — authenticated managed workspace acceptance.
 * COMPANY-UX2.B.2: isolated product, facility, role and capability acceptance.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const base = process.env.DEMOTEST23_WEB_URL;
assert.equal(base, "http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true");
assert.ok(process.env.RUNNER_TEMP);
const people = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "demotest23-personas.json"), "utf8"));
const owner = people.find(person => person.id === "buyer");
const viewer = people.find(person => person.id === "buyerViewer");
assert.ok(owner && viewer, "Local entitled admin and viewer required");
const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.DEMOTEST23_LOCAL_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(serviceKey && anonKey, "Disposable local authentication required");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(dbUrl, serviceKey, options);
// The earlier Romania fixture links an unentitled processor; the profile
// preferences reader additionally requires Network access. Create our own
// strictly local synthetic company for the already entitled buyer.
const companyId = "00000000-0000-4000-8000-000000026160";
const { data: links, error: linkReadError } = await service
  .from("organization_network_company_links").select("id")
  .eq("organization_id", owner.org).eq("link_status", "active");
assert.ifError(linkReadError);
assert.equal(links.length, 0, "Dedicated fixture must not replace an existing active link");
const created = await service.from("network_companies").insert({
  id: companyId, legal_name: "DEMO Company Workspace S.r.l.", country_code: "IT",
  website_url: "https://company-ux2.example.test", website_domain: "company-ux2.example.test",
  description: "Synthetic industrial profile for local visual acceptance only.",
  publication_status: "published", claimed_status: "claimed", verification_status: "unverified",
});
assert.ifError(created.error);
const now = new Date().toISOString();
const { data: claim, error: claimError } = await service.from("network_company_claims").insert({
  network_company_id: companyId, organization_id: owner.org, requested_by: owner.userId,
  status: "approved", reviewed_by: owner.userId, reviewed_at: now, proof_method: "manual_review",
  proof_status: "verified", proof_verified_by: owner.userId, proof_verified_at: now,
}).select("id").single();
assert.ifError(claimError);
const linked = await service.from("organization_network_company_links").insert({
  organization_id: owner.org, network_company_id: companyId, claim_id: claim.id,
  linked_by: owner.userId, link_status: "active",
});
assert.ifError(linked.error);
async function signed(person) {
  const client = createClient(dbUrl, anonKey, options);
  const result = await client.auth.signInWithPassword({ email: person.email, password: person.password });
  assert.ifError(result.error);
  return client;
}
const ownerClient = await signed(owner);
const managed = await ownerClient.rpc("m8_my_network_company");
assert.ifError(managed.error);
assert.equal(managed.data?.network_company_id, companyId, "Admin must resolve exact synthetic company");
for (const [rpc, args] of [
  ["p3_7_managed_profile_state", { p_network_company_id: companyId }],
  ["p3_7d_managed_identity_contacts", { p_network_company_id: companyId }],
  ["p3_7e_managed_product_scope", { p_network_company_id: companyId }],
  ["p4_get_inquiry_preferences", { p_organization_id: owner.org }],
  ["netprofile_ux1b_manage", { p_organization_id: owner.org, p_company_id: companyId }],
]) {
  const result = await ownerClient.rpc(rpc, args);
  assert.equal(result.error?.code, undefined, rpc + " local admin preflight: " + (result.error?.message ?? ""));
}
const viewerClient = await signed(viewer);
const denied = await viewerClient.rpc("m8_my_network_company");
assert.ifError(denied.error);
assert.equal(denied.data, null, "Viewer must not manage company");
await viewerClient.auth.signOut();
await ownerClient.auth.signOut();
console.log("COMPANY-UX2.A local fixture and admin/viewer RPC gates PASS");
const output = path.join(process.env.RUNNER_TEMP, "netro14d-synthetic-visual");
mkdirSync(output, { recursive: true });
// COMM-NAV7 (#1052): Playwright defaults to caret:"hide" and can mutate
// an SSR input before React hydration. Keep screenshot capture DOM-neutral;
// never suppress console or Next.js issue diagnostics.
const sections = ["summary", "overview", "positioning", "products", "facilities", "markets", "certifications", "contacts", "stock", "inquiries"];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const populated of [false, true]) {
    if (populated) {
      const admin = await signed(owner);
      for (const [key, relationship] of [["tubes_pipes", "produces"], ["plates", "distributes"]]) {
        const result = await admin.rpc("p3_7b_set_product", {
          p_network_company_id: companyId, p_product_key: key, p_relationship_type: relationship, p_facility_id: null, p_enabled: true,
        });
        assert.ifError(result.error);
        if (key === "tubes_pipes") {
          assert.ok(result.data?.relation_id);
          const scope = await admin.rpc("p3_7e_managed_product_scope", { p_network_company_id: companyId });
          assert.ifError(scope.error);
          const standard = scope.data.taxonomy.standards.find(item => item.network_product_keys.includes(key) &&
            scope.data.taxonomy.grades.some(grade => grade.standard_id === item.id));
          assert.ok(standard, "Canonical standard with grade required");
          const grade = scope.data.taxonomy.grades.find(item => item.standard_id === standard.id);
          for (const [rpc, args] of [
            ["p3_7e_set_product_standard", {p_company_product_id: result.data.relation_id, p_standard_id: standard.id, p_enabled: true}],
            ["p3_7e_set_product_grade", {p_company_product_id: result.data.relation_id, p_standard_id: standard.id, p_material_grade_id: grade.material_grade_id, p_enabled: true}],
            ["p3_7e_upsert_product_dimension", {p_company_product_id: result.data.relation_id, p_dimension_type: "outer_diameter", p_min_mm: 21.3, p_max_mm: 610}],
          ]) {
            const write = await admin.rpc(rpc, args);
            assert.ifError(write.error);
          }
        }
      }
      const role = await admin.rpc("p3_7b_set_role", {
        p_network_company_id: companyId, p_role_key: "producer", p_enabled: true, p_is_primary: true,
      });
      assert.ifError(role.error);
      const sites = [
        { name: "DEMO Plant", facility_type: "plant", city: "Torino", region: "Piemonte", country_code: "IT", publication_status: "published", capabilities: ["laser_cutting", "welding_fabrication"] },
        { name: "DEMO Warehouse", facility_type: "warehouse", city: null, region: null, country_code: "IT", publication_status: "draft", capabilities: [] },
      ];
      for (const {capabilities, ...payload} of sites) {
        const created = await admin.rpc("p3_7b_upsert_facility", {p_network_company_id: companyId, p_facility_id: null, p_payload: payload});
        assert.ifError(created.error);
        const id = created.data?.facility_id;
        assert.ok(id);
        for (const key of capabilities) {
          const result = await admin.rpc("p3_7b_set_facility_capability", {p_network_company_id: companyId, p_facility_id: id, p_capability_key: key, p_enabled: true});
          assert.ifError(result.error);
        }
        if (payload.facility_type === "plant") {
          // Local synthetic fixture only, matching the existing P3.7B SQL lock test.
          const verified = await service.from("network_facilities").update({verification_status:"verified"}).eq("network_company_id",companyId).eq("id",id).select("id").single();
          assert.ifError(verified.error);
          const locked = await admin.rpc("p3_7b_upsert_facility", {p_network_company_id:companyId,p_facility_id:id,p_payload:{...payload,name:"DEMO blocked edit"}});
          assert.ok(locked.error, "Verified facility must require Platform review");
        }
      }
      const viewerCheck = await signed(viewer);
      const viewerWrite = await viewerCheck.rpc("p3_7b_upsert_facility", {p_network_company_id:companyId,p_facility_id:null,p_payload:{name:"Blocked viewer",facility_type:"office",country_code:"IT",publication_status:"draft"}});
      assert.ok(viewerWrite.error, "Viewer may not create a managed facility");
      await viewerCheck.auth.signOut();
      await admin.auth.signOut();
    }
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 900 : width === 390 ? 844 : 720 },
      locale: "it-IT", reducedMotion: "reduce", serviceWorkers: "block",
    });
    try {
      await context.route("**/*", route => {
        const host = new URL(route.request().url()).hostname;
        return host === "127.0.0.1" || host === "localhost" ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.locator('input[name="email"]').fill(owner.email);
      await page.locator('input[name="password"]').fill(owner.password);
      await page.getByRole("button", { name: "Accedi", exact: true }).click();
      await page.waitForURL(url => url.pathname === "/dashboard", { timeout: 90000 });
      // Capture React/Next development diagnostics too: pageerror alone misses
      // console.error warnings that appear in the Next.js dev issue indicator.
      const consoleIssues = [];
      page.on("console", message => {
        const content = message.text();
        const isFrameworkWarning = /hydration|validateDOMNesting|same key|cannot specify.*form|each child in a list/i.test(content);
        if (message.type() !== "error" && !(message.type() === "warning" && isFrameworkWarning)) return;
        const source = message.location().url;
        // This runner deliberately blocks all third-party network requests.
        if (/Failed to load resource/i.test(content) && /^https?:/.test(source)) {
          const host = new URL(source).hostname;
          if (host !== "127.0.0.1" && host !== "localhost") return;
        }
        // Preserve the actual React attribute diff; the standard hydration
        // preamble alone exceeds 1,200 characters and cannot identify the source.
        const diagnostic = content.slice(0, 24000);
        consoleIssues.push(diagnostic);
        console.error("COMPANY-UX2.A BROWSER DIAGNOSTIC " + new URL(page.url()).pathname + "\n" + diagnostic);
      });
      const response = await page.goto(base + "/company/profile", { waitUntil: "domcontentloaded", timeout: 90000 });
      assert.equal(response?.status(), 200);
      const workspace = page.getByTestId("company-workspace");
      try {
        await workspace.waitFor({ state: "visible", timeout: 30000 });
      } catch (error) {
        await page.screenshot({ path: path.join(output, "company-ux2a-entry-failed-" + width + ".png"), fullPage: true, animations: "disabled", caret: "initial" });
        console.error("Managed page entry failed", new URL(page.url()).pathname, (await page.locator("body").innerText()).slice(0, 1500), errors);
        throw error;
      }
      assert.equal(await page.getByRole("heading", { name: "DEMO Company Workspace S.r.l.", exact: true }).count(), 1);
      const nav = workspace.getByRole("navigation", { name: "Gestione azienda" });
      async function check(id, capture = false) {
        const panel = workspace.locator("#company-panel-" + id);
        await panel.waitFor({ state: "visible", timeout: 30000 });
        assert.equal(await nav.locator('[aria-current="page"]').getAttribute("href"), "#" + id);
        assert.equal(await workspace.locator('[id^="company-panel-"]:visible').count(), 1);
        const metrics = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
        }));
        assert.ok(metrics.document <= metrics.viewport + 2,
          "Horizontal overflow " + width + " " + id + ": " + JSON.stringify(metrics));
        if (capture) await page.screenshot({
          path: path.join(output, "company-ux2b2-" + (populated ? "populated-" : "empty-") + id + "-" + width + ".png"),
          fullPage: true, animations: "disabled", caret: "initial",
        });
      }
      await check("summary", true);
      for (const id of sections.slice(1)) {
        await nav.locator('a[href="#' + id + '"]').click();
        await check(id, ["overview", "positioning", "products", "facilities", "stock"].includes(id));
      }
      await page.goBack();
      await check("stock");
      await page.goForward();
      await check("inquiries");
      await page.goto(base + "/network/manage#products", { waitUntil: "domcontentloaded" });
      await check("products");
      const catalog = workspace.getByTestId("company-product-catalog");
      await catalog.waitFor({state:"visible"});
      const cards = catalog.getByTestId("company-product-card");
      assert.equal(await cards.count(), populated ? 2 : 0);
      if (populated) {
        const tube = cards.filter({has: page.locator('[data-family-shape="tube"]')});
        assert.equal(await tube.count(), 1);
        assert.match(await tube.innerText(), /Produce/);
        for (const label of ["Norme", "Gradi", "Range"]) {
          assert.equal(await tube.locator("dl > div").filter({hasText:label}).locator("dd").innerText(), "1");
        }
        await tube.getByRole("link", {name:"Gestisci specifiche"}).click();
        await page.waitForURL(url => url.hash.startsWith("#products-item-"));
        await check("products");
        assert.ok(await page.locator('[id^="products-item-"]:focus').count(), "Technical editor receives focus");
      } else {
        assert.equal(await catalog.getByTestId("company-product-catalog-empty").count(), 1);
        assert.match(await catalog.innerText(), /non associati alla tua azienda/);
      }
      await catalog.getByRole("link", {name:"Aggiungi famiglia"}).click();
      await page.waitForURL(url=>url.hash==="#products-add");
      await check("products");
      await page.locator("#products-add").waitFor({state:"visible"});
      assert.equal(await page.locator("#products-add select[name=product_key] option").count(), 12);
      await nav.locator('a[href="#positioning"]').click();
      await check("positioning");
      const roles = workspace.locator("#company-panel-positioning").getByTestId("company-industrial-role");
      assert.equal(await roles.count(), populated ? 1 : 0);
      if (populated) assert.match(await roles.first().innerText(), /principale/);
      await nav.locator('a[href="#facilities"]').click();
      await check("facilities");
      const footprint = workspace.getByTestId("company-industrial-footprint");
      const siteCards = footprint.getByTestId("company-facility-card");
      assert.equal(await siteCards.count(), populated ? 2 : 0);
      const stats = footprint.getByTestId("company-industrial-counts");
      assert.deepEqual(await stats.locator("dd").allTextContents(), populated ? ["2", "2", "1"] : ["0", "0", "0"]);
      if (populated) {
        const plant = siteCards.filter({hasText:"DEMO Plant"});
        const warehouse = siteCards.filter({hasText:"DEMO Warehouse"});
        assert.match(await plant.innerText(), /Torino, Piemonte, IT/);
        assert.match(await plant.innerText(), /Visibilità: Pubblicata/);
        assert.equal(await plant.getByTestId("company-facility-capability").count(), 2);
        assert.match(await plant.innerText(), /Dichiarata dall’azienda · Non verificato/);
        assert.match(await warehouse.innerText(), /Visibilità: Bozza/);
        assert.equal(await warehouse.getByTestId("company-facility-capability").count(), 0);
        await plant.getByRole("link",{name:"Consulta sede e lavorazioni"}).click();
        await page.waitForURL(url=>url.hash.startsWith("#facilities-item-"));
        await check("facilities");
        const locked = page.locator('[id^="facilities-item-"]:focus');
        await locked.waitFor({state:"visible"});
        assert.match(await locked.innerText(), /non può essere modificata direttamente/);
        assert.equal(await locked.getByRole("button",{name:"Salva sede",exact:true}).count(), 0);
        assert.equal(await locked.getByRole("button",{name:"Archivia sede",exact:true}).count(), 0);
        const href = await warehouse.getByRole("link",{name:"Gestisci sede e lavorazioni"}).getAttribute("href");
        await warehouse.getByRole("link",{name:"Gestisci sede e lavorazioni"}).click();
        await page.waitForURL(url=>url.hash===href);
        await check("facilities");
        assert.equal(await workspace.locator(href).getByRole("button",{name:"Salva sede",exact:true}).count(), 1);
      } else {
        assert.equal(await footprint.getByTestId("company-facilities-empty").count(), 1);
      }
      await footprint.getByRole("link",{name:"Aggiungi sede"}).click();
      await page.waitForURL(url=>url.hash==="#facilities-add");
      await check("facilities");
      assert.equal(await page.locator("#facilities-add").getByRole("button",{name:"Crea sede",exact:true}).count(), 1);
      await nav.locator('a[href="#summary"]').click();
      await check("summary");
      await workspace.locator("#company-panel-summary").getByRole("link", { name: "Gestisci preferenze" }).click();
      await check("inquiries");
      // Check a real governed save only in the disposable local DB. Never publish stock.
      if (width === 1440) {
        await nav.locator('a[href="#overview"]').click();
        await check("overview");
        const editor = workspace.locator("#company-panel-overview");
        const description = editor.locator('textarea[name="description"]');
        const before = await description.inputValue();
        await editor.getByRole("button", { name: "Salva overview", exact: true }).click();
        await page.waitForURL(url => url.pathname === "/network/manage" && url.searchParams.has("message") && url.hash === "#overview", { timeout: 90000 });
        await check("overview");
        assert.match(await page.getByRole("status").filter({hasText:"Profilo Network aggiornato"}).innerText(), /Profilo Network aggiornato/);
        assert.equal(await description.inputValue(), before.trim());
      }
      // The managed stock editor must still be reachable; do not publish any data.
      await nav.locator('a[href="#stock"]').click();
      await check("stock");
      assert.equal(await page.getByTestId("network-stock-manager").count(), 1);
      assert.deepEqual(errors, [], "Uncaught browser errors at " + width);
      if (consoleIssues.length) {
        await page.screenshot({ path: path.join(output, "company-ux2a-console-failed-" + width + ".png"), fullPage: true, animations: "disabled", caret: "initial" });
      }
      assert.deepEqual([...new Set(consoleIssues)], [], "Browser console errors at " + width);
      console.log("COMPANY-UX2.B.2 Chrome PASS", width, populated ? "populated" : "empty", "catalog, facility cards, capabilities, roles, navigation, stock and screenshots");
    } finally { await context.close(); }
  }
  }
} finally { await browser.close(); }
