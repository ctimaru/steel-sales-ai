/**
 * COMPANY-UX2.A — authenticated managed workspace acceptance.
 * Run only after the Network visual fixture, against its disposable local DB.
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
const sections = ["summary", "overview", "positioning", "products", "facilities", "markets", "certifications", "contacts", "stock", "inquiries"];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
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
      const response = await page.goto(base + "/company/profile", { waitUntil: "domcontentloaded", timeout: 90000 });
      assert.equal(response?.status(), 200);
      const workspace = page.getByTestId("company-workspace");
      try {
        await workspace.waitFor({ state: "visible", timeout: 30000 });
      } catch (error) {
        await page.screenshot({ path: path.join(output, "company-ux2a-entry-failed-" + width + ".png"), fullPage: true, animations: "disabled" });
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
          path: path.join(output, "company-ux2a-" + id + "-" + width + ".png"),
          fullPage: true, animations: "disabled",
        });
      }
      await check("summary", true);
      for (const id of sections.slice(1)) {
        await nav.locator('a[href="#' + id + '"]').click();
        await check(id, ["overview", "products", "stock"].includes(id));
      }
      await page.goBack();
      await check("stock");
      await page.goForward();
      await check("inquiries");
      await page.goto(base + "/network/manage#products", { waitUntil: "domcontentloaded" });
      await check("products");
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
      console.log("COMPANY-UX2.A Chrome PASS", width, "ten panels, history, deep links, stock and screenshots");
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
