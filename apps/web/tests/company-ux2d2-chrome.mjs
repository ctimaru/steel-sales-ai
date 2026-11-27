/** D.2: real catalogue upload and withdrawal against disposable localhost only. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const base = process.env.DEMOTEST23_WEB_URL;
assert.equal(base, "http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true");
assert.equal(process.env.NETWORK_VISUAL_FIXTURE, "true");
assert.ok(process.env.RUNNER_TEMP);
const people = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "demotest23-personas.json"), "utf8"));
const owner = people.find(person => person.id === "buyer");
const viewer = people.find(person => person.id === "buyerViewer");
const otherTenant = people.find(person => person.id === "producer");
assert.ok(owner && viewer && otherTenant && owner.org !== otherTenant.org);
const companyId = "00000000-0000-4000-8000-000000026160";
const sourceOrigin = "https://company-ux2.example.test";
const rpcName = "netproducers1_b3c2_catalog_submission";
const rpcPath = "/rest/v1/rpc/" + rpcName;
const rpcUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + rpcPath;
const output = path.join(process.env.RUNNER_TEMP, "netro14d-synthetic-visual");
mkdirSync(output, { recursive: true });
const sqlString = value => "'" + String(value).replaceAll("'", "''") + "'";
const psqlArgs = ["--host", "127.0.0.1", "--port", "54322", "--username", "postgres", "--dbname", "postgres", "--set", "ON_ERROR_STOP=1", "--no-psqlrc", "--quiet", "--tuples-only", "--no-align"];
function localSql(statement) {
  return execFileSync("psql", psqlArgs, {
    input: statement, env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}
function fixtureSql(statement) { localSql("BEGIN;\n" + statement + "\nCOMMIT;\n"); }
function sqlJson(expression) { return JSON.parse(localSql("SELECT " + expression + ";\n")); }
function submissionCount() {
  return Number(localSql("SELECT count(*) FROM private.network_producer_catalog_submissions WHERE company_id=" + sqlString(companyId) + ";"));
}
function grantEventCount(id) {
  return Number(localSql("SELECT count(*) FROM private.network_producer_catalog_events WHERE catalog_id=" + sqlString(id) + ";"));
}
function setPublication(status) {
  assert.ok(["published", "pending_review"].includes(status));
  fixtureSql("UPDATE public.network_companies SET publication_status=" + sqlString(status) + " WHERE id=" + sqlString(companyId) + ";");
}
const originalCompany = sqlJson("(SELECT jsonb_build_object('publication_status',publication_status,'website_url',website_url) FROM public.network_companies WHERE id=" + sqlString(companyId) + ")");
assert.equal(originalCompany.website_url, sourceOrigin, "Only the earlier synthetic Company fixture may be changed");
assert.equal(originalCompany.publication_status, "published");
assert.equal(submissionCount(), 0, "The earlier suites must not create catalogue submissions");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
function syntheticPdf() {
  const stream = "BT /F1 12 Tf 36 760 Td (DEMO D2 - synthetic local catalogue) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
  ];
  let contents = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, value] of objects.entries()) {
    offsets.push(Buffer.byteLength(contents));
    contents += (index + 1) + " 0 obj\n" + value + "\nendobj\n";
  }
  const xref = Buffer.byteLength(contents);
  contents += "xref\n0 6\n0000000000 65535 f \n" + offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n \n").join("");
  contents += "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
  return Buffer.from(contents, "ascii");
}
async function signed(person) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
  const result = await client.auth.signInWithPassword({ email: person.email, password: person.password });
  assert.ifError(result.error);
  return client;
}
const admin = await signed(owner);
async function status(client = admin) {
  const result = await client.rpc(rpcName, { p_operation: "status", p_payload: { company_id: companyId } });
  assert.ifError(result.error);
  assert.equal(result.data?.contract, "netproducers-b3c2-v1");
  assert.equal(result.data?.details_contract, "company-ux2d2-catalog-status-v1");
  assert.equal(result.data?.limit, 20);
  assert.ok(Array.isArray(result.data?.items));
  return result.data;
}
async function readItem(id) {
  const item = (await status()).items.find(item => item.catalog_id === id);
  assert.ok(item, "Expected managed catalogue " + id);
  return item;
}
assert.equal((await status()).eligible, true, "Published producer with verified owner claim must be eligible");
for (const person of [viewer, otherTenant]) {
  const deniedClient = await signed(person);
  assert.deepEqual((await status(deniedClient)).items, []);
  assert.equal((await status(deniedClient)).eligible, false);
  const denied = await deniedClient.rpc(rpcName, {
    p_operation: "prepare", p_payload: {
      company_id: companyId, source_url: sourceOrigin + "/cataloghi/forbidden.csv",
      edition: "DEMO", name: "forbidden.csv", format: "csv",
      sha256: "0".repeat(64), rights_declaration: true,
    },
  });
  assert.equal(denied.error?.code, "42501");
  await deniedClient.auth.signOut();
}
assert.equal(submissionCount(), 0, "Denied identities must not prepare uploads");

// Fixture-only metadata covers states which a stopped local issuer cannot reach.
// It never calls the worker or a hosted service, and never supplies these rights
// to production. Pending jobs/candidates let the real owner withdrawal prove
// its transactional effect on already-authorized derived work.
function seedCatalogue(label, rights = "not_verified", submissionState = "in_analysis") {
  const id = randomUUID();
  const sha = createHash("sha256").update("local D2 " + id).digest("hex");
  const format = rights === "active" ? "csv" : "pdf";
  const sourceUrl = sourceOrigin + "/cataloghi/" + id + "." + format;
  const objectPath = companyId + "/" + id + "/" + sha + "." + format;
  const name = "DEMO D2 " + label + "." + format;
  fixtureSql("INSERT INTO private.network_producer_catalog_submissions " +
    "(catalog_id,company_id,organization_id,submitted_by,source_url,edition,original_name,document_format,document_sha256,object_path,state,created_at,rights_declared_at,uploaded_at,source_checked_at,withdrawn_at) VALUES (" +
    [id, companyId, owner.org, owner.userId, sourceUrl, "DEMO 2026", name, format, sha, objectPath, submissionState].map(sqlString).join(",") +
    ",now()-interval '8 days',now()-interval '8 days',now()-interval '7 days',now()-interval '6 days'," +
    (submissionState === "withdrawn" ? "now()-interval '1 day'" : "null") + ");");
  if (rights !== "not_verified") {
    assert.ok(["active", "expired", "revoked"].includes(rights));
    fixtureSql("INSERT INTO private.network_producer_catalog_grants " +
      "(catalog_id,company_id,source_url,document_sha256,edition,document_format,rights,verification_method,verification_reference,verified_at,expires_at,status,revoked_at,created_at) VALUES (" +
      [id, companyId, sourceUrl, sha, "DEMO 2026", format].map(sqlString).join(",") +
      ",ARRAY['extract','store_derived','use_in_producer_search'],'verified_company_authorization'," + sqlString("rights-demo-" + id.replaceAll("-", "")) +
      ",now()-interval '6 days'," + (rights === "expired" ? "now()-interval '1 day'" : "now()+interval '1 year'") +
      "," + sqlString(rights === "revoked" ? "revoked" : "approved") + "," +
      (rights === "revoked" ? "now()-interval '1 day'" : "null") + ",now()-interval '5 days');");
  }
  if (rights === "active") {
    fixtureSql("INSERT INTO private.network_producer_catalog_candidate_rows " +
      "(catalog_id,company_id,document_sha256,source_locator,standard,grade,shape,dimensions_mm) VALUES (" +
      [id, companyId, sha].map(sqlString).join(",") + ",'csv_row:2','EN10219','S355J2H','CHS','[168.3,6.3]'::jsonb);\n" +
      "INSERT INTO private.network_producer_catalog_ingest_jobs " +
      "(catalog_id,company_id,document_sha256,object_path) VALUES (" +
      [id, companyId, sha, objectPath].map(sqlString).join(",") + ");");
  }
  return { id, name, sourceUrl, rights };
}
function clearSubmissions() {
  // Nothing runs the source verifier in this isolated fixture. These local
  // rows have no source-verification ledger children; uploaded objects and B2
  // audit history are retained until the disposable stack is destroyed.
  fixtureSql("DELETE FROM private.network_producer_catalog_submissions WHERE company_id=" + sqlString(companyId) + " AND organization_id=" + sqlString(owner.org) + ";");
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 }, locale: "it-IT",
      reducedMotion: "reduce", serviceWorkers: "block",
    });
    let page;
    let expectedRpcFailure = null;
    const errors = [];
    const consoleIssues = [];
    const writes = [];
    try {
      await context.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      page = await context.newPage();
      page.on("request", request => {
        if (new URL(request.url()).pathname !== rpcPath || request.method() !== "POST") return;
        const operation = request.postDataJSON()?.p_operation;
        if (["prepare", "finalize", "withdraw"].includes(operation)) writes.push(operation);
      });
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        const content = message.text();
        if (message.type() !== "error" && !(message.type() === "warning" && /hydration|validateDOMNesting|same key|cannot specify.*form|each child in a list/i.test(content))) return;
        const source = message.location().url;
        if (expectedRpcFailure && source === rpcUrl && new RegExp("Failed to load resource.*" + expectedRpcFailure).test(content)) return;
        if (/Failed to load resource/i.test(content) && /^https?:/.test(source) && !["127.0.0.1", "localhost"].includes(new URL(source).hostname)) return;
        consoleIssues.push(content.slice(0, 24000));
      });
      await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.locator('input[name="email"]').fill(owner.email);
      await page.locator('input[name="password"]').fill(owner.password);
      await page.getByRole("button", { name: "Accedi", exact: true }).click();
      await page.waitForURL(url => url.pathname === "/dashboard", { timeout: 90000 });
      const response = await page.goto(base + "/company/profile#products-catalogues", { waitUntil: "domcontentloaded", timeout: 90000 });
      assert.equal(response?.status(), 200);
      const workspace = page.getByTestId("company-workspace");
      const manager = page.getByTestId("company-catalogue-workspace");
      const editor = manager.getByTestId("catalogue-editor");
      const form = manager.getByTestId("producer-catalogue-form");
      const card = id => manager.locator('[data-testid="company-catalogue-card"][data-catalog-id="' + id + '"]');
      const feedback = role => manager.locator('[data-testid="catalogue-feedback"][role="' + role + '"]');
      const formFeedback = form.getByTestId("catalogue-form-feedback");
      await manager.waitFor({ state: "visible", timeout: 30000 });
      await manager.getByTestId("catalogue-empty").waitFor({ state: "visible", timeout: 30000 });
      assert.equal(await workspace.locator('[id^="company-panel-"]:visible').count(), 1);
      assert.equal(await workspace.getByRole("navigation", { name: "Gestione azienda" }).locator('[aria-current="page"]').getAttribute("href"), "#products");
      async function capture(target, name, full = false) {
        const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(metrics.scroll <= metrics.width + 2, "D2 overflow " + name + " at " + width + ": " + JSON.stringify(metrics));
        const stem = path.join(output, "company-ux2d2-" + name);
        if (full) {
          await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
          await page.screenshot({ path: stem + "-" + width + ".png", fullPage: true, animations: "disabled", caret: "initial" });
        }
        await target.evaluate(element => {
          const header = document.querySelector("header.sticky")?.getBoundingClientRect().height ?? 0;
          window.scrollTo({ top: Math.max(0, window.scrollY + element.getBoundingClientRect().top - header - 16), left: 0, behavior: "instant" });
        });
        await page.screenshot({ path: stem + "-top-" + width + ".png", animations: "disabled", caret: "initial" });
        const lowerView = await target.evaluate(element => {
          const navigation = document.querySelector('nav[aria-label="Navigazione mobile principale"]')?.getBoundingClientRect().height ?? 0;
          const remaining = element.getBoundingClientRect().bottom - (window.innerHeight - navigation - 16);
          if (remaining <= 2) return false;
          window.scrollBy({ top: remaining, left: 0, behavior: "instant" });
          return true;
        });
        if (lowerView) await page.screenshot({ path: stem + "-actions-" + width + ".png", animations: "disabled", caret: "initial" });
      }
      async function expectFocus(locator) {
        await locator.and(page.locator(":focus")).waitFor({ state: "visible", timeout: 30000 });
        assert.equal(await locator.evaluate(element => element === document.activeElement), true);
      }
      async function refresh() {
        const loaded = page.waitForResponse(response => response.url() === rpcUrl && response.request().postDataJSON()?.p_operation === "status", { timeout: 30000 });
        await manager.getByRole("button", { name: "Aggiorna cataloghi", exact: true }).click();
        assert.equal((await loaded).status(), 200);
      }
      async function openNew() {
        await manager.getByRole("button", { name: "Aggiungi catalogo", exact: true }).click();
        await editor.waitFor({ state: "visible" });
      }
      async function values() {
        return form.locator("input").evaluateAll(fields => fields.map(field => ({
          type: field.type, name: field.name || field.id,
          value: field.type === "file" ? [...(field.files ?? [])].map(file => file.name).join(",") : field.value,
          checked: field.type === "checkbox" ? field.checked : undefined,
        })));
      }
      const document = width === 390 ? {
        name: "DEMO-D2-" + width + ".pdf", mimeType: "application/pdf", buffer: syntheticPdf(),
      } : {
        name: "DEMO-D2-" + width + ".csv", mimeType: "text/csv",
        buffer: Buffer.from("standard,grade,shape,dimensions_mm\nEN10219,S355J2H,CHS,168.3x6.3\n", "utf8"),
      };
      const uploadUrl = sourceOrigin + "/cataloghi/" + document.name;
      async function fillUpload(url = uploadUrl) {
        await form.locator("#producer-catalog-file").setInputFiles(document);
        await form.getByRole("textbox", { name: "Edizione", exact: true }).fill("DEMO 2026 / " + width);
        await form.getByRole("textbox", { name: "URL ufficiale del catalogo", exact: true }).fill(url);
        await form.getByRole("checkbox", { name: "Dichiaro i diritti del produttore", exact: true }).check();
      }
      await capture(manager, "empty");
      const navigation = workspace.getByRole("navigation", { name: "Gestione azienda" });
      const beforeNavigationWrites = writes.length;
      const beforeNavigationRows = submissionCount();
      for (const entry of [
        { section: "summary", link: page.getByRole("link", { name: "Cataloghi tecnici", exact: true }) },
        { section: "stock", link: workspace.locator("#company-panel-stock").getByRole("link", { name: "Gestisci cataloghi ufficiali", exact: true }) },
      ]) {
        await navigation.locator('a[href="#' + entry.section + '"]').click();
        await workspace.locator("#company-panel-" + entry.section).waitFor({ state: "visible" });
        await manager.waitFor({ state: "hidden" });
        await entry.link.click();
        await page.waitForURL(url => url.pathname === "/company/profile" && url.hash === "#products-catalogues");
        await workspace.locator("#company-panel-products").waitFor({ state: "visible" });
        await manager.getByTestId("catalogue-empty").waitFor({ state: "visible" });
        assert.equal(await workspace.locator('[id^="company-panel-"]:visible').count(), 1);
        assert.equal(await navigation.locator('[aria-current="page"]').getAttribute("href"), "#products");
      }
      assert.equal(writes.length, beforeNavigationWrites, "Catalogue links only navigate; they cannot prepare or modify an upload");
      assert.equal(submissionCount(), beforeNavigationRows);
      const beforeCancel = submissionCount();
      const cancelledWrites = writes.length;
      await openNew();
      await fillUpload();
      await capture(editor, "new-upload");
      await form.getByRole("button", { name: "Annulla caricamento", exact: true }).click();
      await editor.waitFor({ state: "hidden" });
      await expectFocus(manager.getByRole("button", { name: "Aggiungi catalogo", exact: true }));
      assert.equal(submissionCount(), beforeCancel);
      assert.equal(writes.length, cancelledWrites, "Cancel must never prepare, upload or finalize a document");
      await openNew();
      assert.equal(await form.locator("#producer-catalog-file").inputValue(), "");
      assert.equal(await form.getByRole("checkbox", { name: "Dichiaro i diritti del produttore", exact: true }).isChecked(), false);
      await fillUpload("http://company-ux2.example.test/cataloghi/not-secure.csv");
      const invalidValues = await values();
      await form.getByRole("button", { name: "Invia il catalogo", exact: true }).click();
      await formFeedback.waitFor({ state: "visible" });
      await expectFocus(formFeedback);
      assert.deepEqual(await values(), invalidValues, "Validation must preserve file, URL, edition and rights choice");
      assert.equal(submissionCount(), beforeCancel);
      assert.equal(writes.length, cancelledWrites);
      await capture(editor, "validation-preserved");
      await form.getByRole("textbox", { name: "URL ufficiale del catalogo", exact: true }).fill(uploadUrl);

      if (width === 1440) {
        for (const oversized of [
          { name: "DEMO-D2-too-large.csv", mimeType: "text/csv", buffer: Buffer.alloc(2 * 1024 * 1024 + 1, "x") },
          { name: "DEMO-D2-too-large.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(8 * 1024 * 1024 + 1, "x") },
        ]) {
          await form.locator("#producer-catalog-file").setInputFiles(oversized);
          const oversizedDraft = await values();
          await form.getByRole("button", { name: "Invia il catalogo", exact: true }).click();
          await expectFocus(formFeedback);
          assert.match(await formFeedback.innerText(), /PDF 8 MB, CSV 2 MB/);
          assert.deepEqual(await values(), oversizedDraft);
          assert.equal(writes.length, cancelledWrites, "Oversized files must be rejected before any upload reservation");
          assert.equal(submissionCount(), beforeCancel);
        }
        await form.locator("#producer-catalog-file").setInputFiles(document);
        // A real database denial between opening and submitting the form must
        // preserve the upload draft. This is the only expected HTTP 403.
        setPublication("pending_review");
        const draft = await values();
        expectedRpcFailure = 403;
        const rejected = page.waitForResponse(response => response.url() === rpcUrl && response.request().postDataJSON()?.p_operation === "prepare");
        await form.getByRole("button", { name: "Invia il catalogo", exact: true }).click();
        const deniedResponse = await rejected;
        assert.equal(deniedResponse.status(), 403);
        assert.equal((await deniedResponse.json()).code, "42501");
        await expectFocus(formFeedback);
        assert.deepEqual(await values(), draft);
        assert.equal(submissionCount(), beforeCancel);
        await capture(editor, "writer-denial");
        setPublication("published");
        expectedRpcFailure = null;
      }

      const beforeUploadWrites = writes.length;
      const uploadDraft = await values();
      let committedFinalization;
      const loseFinalizationReceipt = async route => {
        if (route.request().postDataJSON()?.p_operation !== "finalize") return route.fallback();
        const actual = await route.fetch({ maxRedirects: 0 });
        committedFinalization = { status: actual.status(), body: await actual.json() };
        // The real local writer has run. Only its response to the browser is
        // replaced to reproduce an acknowledgement lost after commit.
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "D2_LOCAL_ACK_LOST", message: "Synthetic local acknowledgement failure" }) });
      };
      if (width === 320) {
        expectedRpcFailure = 503;
        await page.route(rpcUrl, loseFinalizationReceipt);
      }
      if (width === 1440) {
        let releasePreparation;
        const holdPreparation = new Promise(resolve => { releasePreparation = resolve; });
        const preparationSeen = page.waitForRequest(request => request.url() === rpcUrl && request.postDataJSON()?.p_operation === "prepare");
        const delayPreparation = async route => {
          if (route.request().postDataJSON()?.p_operation !== "prepare") return route.fallback();
          await holdPreparation;
          return route.fallback();
        };
        await page.route(rpcUrl, delayPreparation);
        try {
          // Two synchronous submit events exercise the ref guard before the
          // first state update has disabled the visible controls.
          await form.evaluate(element => { element.requestSubmit(); element.requestSubmit(); });
          await preparationSeen;
          assert.equal(await form.getAttribute("aria-busy"), "true");
          assert.equal(await form.locator("fieldset").isDisabled(), true);
          assert.equal(await manager.getByRole("button", { name: "Aggiorna cataloghi", exact: true }).isDisabled(), true);
          await capture(editor, "upload-busy");
        } finally {
          releasePreparation();
          await page.unroute(rpcUrl, delayPreparation);
        }
      } else {
        await form.getByRole("button", { name: "Invia il catalogo", exact: true }).click();
      }
      if (width === 320) {
        await expectFocus(formFeedback);
        assert.equal(committedFinalization?.status, 200);
        assert.equal(committedFinalization?.body.status, "pending_provenance");
        assert.match(await formFeedback.innerText(), /esito del caricamento non è confermato/);
        assert.deepEqual(await values(), uploadDraft, "Lost acknowledgement must preserve the entire form");
        assert.equal(await form.getByRole("button", { name: "Invia il catalogo", exact: true }).isDisabled(), true);
        await capture(editor, "uncertain-upload");
        await page.unroute(rpcUrl, loseFinalizationReceipt);
        const rechecked = page.waitForResponse(response => response.url() === rpcUrl && response.request().postDataJSON()?.p_operation === "status");
        await form.getByRole("button", { name: "Controlla lo stato", exact: true }).click();
        assert.equal((await rechecked).status(), 200);
        await manager.getByTestId("catalogue-summary").waitFor({ state: "visible" });
        assert.deepEqual(await values(), uploadDraft);
        assert.equal(await form.getByRole("button", { name: "Invia il catalogo", exact: true }).isDisabled(), true, "A status read cannot silently authorize a duplicate upload");
        await form.getByRole("button", { name: "Annulla caricamento", exact: true }).click();
        await editor.waitFor({ state: "hidden" });
        expectedRpcFailure = null;
      } else {
        await editor.waitFor({ state: "hidden", timeout: 30000 });
        await expectFocus(feedback("status"));
      }
      assert.deepEqual(writes.slice(beforeUploadWrites), ["prepare", "finalize"], "Exactly one preparation and finalization per upload");
      assert.equal(submissionCount(), beforeCancel + 1);
      const uploaded = (await status()).items.find(item => item.name === document.name);
      assert.ok(uploaded);
      assert.equal(uploaded.state, "pending_provenance");
      assert.equal(uploaded.rights_status, "not_verified");
      assert.equal(uploaded.source_url, uploadUrl);
      assert.ok(uploaded.uploaded_at && uploaded.rights_declared_at);
      assert.equal(uploaded.rights_verified_at, null);
      assert.equal(uploaded.source_checked_at, null);
      await card(uploaded.catalog_id).waitFor({ state: "visible" });
      assert.equal(await card(uploaded.catalog_id).getAttribute("data-rights-status"), "not_verified");
      assert.equal(await card(uploaded.catalog_id).getByText("Diritti da verificare", { exact: true }).count(), 1);
      assert.equal(await card(uploaded.catalog_id).getByText("Diritti dichiarati", { exact: true }).count(), 1);
      assert.equal(await card(uploaded.catalog_id).getByText("Diritti verificati", { exact: true }).count(), 0);
      assert.equal(await card(uploaded.catalog_id).locator('a[href="' + uploadUrl + '"]').count(), 1);
      const stored = sqlJson("(SELECT jsonb_build_object('sha',document_sha256,'bytes',(SELECT (metadata->>'size')::int FROM storage.objects o WHERE o.bucket_id='producer-authorized-catalogs' AND o.name=s.object_path)) FROM private.network_producer_catalog_submissions s WHERE s.catalog_id=" + sqlString(uploaded.catalog_id) + ")");
      assert.equal(stored.sha, createHash("sha256").update(document.buffer).digest("hex"));
      assert.equal(stored.bytes, document.buffer.length);
      assert.equal(Number(localSql("SELECT count(*) FROM private.network_producer_catalog_grants WHERE catalog_id=" + sqlString(uploaded.catalog_id) + ";")), 0, "Upload must not grant rights");

      const active = seedCatalogue("diritti attivi " + width, "active");
      const expired = seedCatalogue("diritti scaduti " + width, "expired");
      const revoked = seedCatalogue("diritti revocati " + width, "revoked");
      const rightsLabels = { active: "Diritti autorizzati", expired: "Autorizzazione scaduta", revoked: "Autorizzazione revocata" };
      await refresh();
      await card(active.id).waitFor({ state: "visible" });
      for (const entry of [active, expired, revoked]) {
        const record = await readItem(entry.id);
        assert.equal(record.state, "in_analysis");
        assert.equal(record.rights_status, entry.rights);
        assert.equal(await card(entry.id).getAttribute("data-state"), "in_analysis");
        assert.equal(await card(entry.id).getAttribute("data-rights-status"), entry.rights);
        assert.equal(await card(entry.id).getByText(rightsLabels[entry.rights], { exact: true }).count(), 1);
        assert.equal(await card(entry.id).getByText("Diritti dichiarati", { exact: true }).count(), 1);
        assert.equal(await card(entry.id).getByText("Diritti verificati", { exact: true }).count(), 1);
        assert.equal(await card(entry.id).getByText("Scadenza autorizzazione", { exact: true }).count(), 1);
        assert.equal(await card(entry.id).locator('a[href="' + entry.sourceUrl + '"]').count(), 1);
        assert.ok(record.source_checked_at && record.rights_verified_at && record.rights_expires_at);
      }
      await capture(manager, "document-rights", true);

      const activeBefore = await readItem(active.id);
      const beforeWithdrawEvents = grantEventCount(active.id);
      const beforeWithdrawWrites = writes.length;
      await card(active.id).getByRole("button", { name: /^Revoca/ }).click();
      const confirmation = manager.getByTestId("catalogue-withdraw-confirmation");
      await confirmation.waitFor({ state: "visible" });
      assert.ok((await confirmation.innerText()).includes(active.name), "Confirmation identifies the chosen document");
      await capture(confirmation, "withdraw-confirmation");
      await confirmation.getByRole("button", { name: "Mantieni catalogo", exact: true }).click();
      await confirmation.waitFor({ state: "hidden" });
      await expectFocus(card(active.id).getByRole("button", { name: /^Revoca/ }));
      assert.deepEqual(await readItem(active.id), activeBefore);
      assert.equal(grantEventCount(active.id), beforeWithdrawEvents);
      assert.equal(writes.length, beforeWithdrawWrites, "Dismissing withdrawal must not send a writer command");
      await card(active.id).getByRole("button", { name: /^Revoca/ }).click();
      await confirmation.getByRole("button", { name: "Conferma revoca", exact: true }).click();
      await confirmation.waitFor({ state: "hidden", timeout: 30000 });
      await expectFocus(feedback("status"));
      await page.waitForFunction(id => document.querySelector('[data-testid="company-catalogue-card"][data-catalog-id="' + id + '"]')?.getAttribute("data-state") === "withdrawn", active.id);
      const withdrawn = await readItem(active.id);
      assert.equal(withdrawn.state, "withdrawn");
      assert.equal(withdrawn.rights_status, "revoked");
      assert.ok(withdrawn.withdrawn_at && withdrawn.rights_revoked_at);
      assert.equal(grantEventCount(active.id), beforeWithdrawEvents + 1);
      assert.deepEqual(writes.slice(beforeWithdrawWrites), ["withdraw"]);
      assert.equal(localSql("SELECT evidence_status FROM private.network_producer_catalog_candidate_rows WHERE catalog_id=" + sqlString(active.id) + ";"), "stale");
      assert.equal(localSql("SELECT state FROM private.network_producer_catalog_ingest_jobs WHERE catalog_id=" + sqlString(active.id) + ";"), "blocked");
      assert.equal(await card(active.id).getByRole("button", { name: /^Revoca/ }).count(), 0);
      await capture(card(active.id), "withdrawn");

      if (width === 1440) {
        let releaseRead;
        const holdRead = new Promise(resolve => { releaseRead = resolve; });
        const readSeen = page.waitForRequest(request => request.url() === rpcUrl && request.postDataJSON()?.p_operation === "status");
        const delayRead = async route => {
          if (route.request().postDataJSON()?.p_operation !== "status") return route.fallback();
          await holdRead;
          return route.fallback();
        };
        await page.route(rpcUrl, delayRead);
        const refreshed = refresh();
        try {
          await readSeen;
          const loading = manager.getByRole("status").filter({ hasText: "Lettura dei cataloghi" });
          await loading.waitFor({ state: "visible" });
          assert.equal(await manager.getByTestId("catalogue-empty").count(), 0);
          assert.equal(await manager.getByTestId("catalogue-ineligible").count(), 0);
          assert.equal(await manager.getByTestId("catalogue-unavailable").count(), 0);
          assert.equal(await manager.getByTestId("catalogue-summary").count(), 0);
          await capture(loading, "loading");
        } finally {
          releaseRead();
          await page.unroute(rpcUrl, delayRead);
        }
        await refreshed;
        await card(uploaded.catalog_id).waitFor({ state: "visible" });
      }

      // Malformed status is an unavailable read, never a claimed empty or
      // ineligible state. The next actual RPC response recovers the same rows.
      const beforeUnavailable = submissionCount();
      let corruptedReads = 0;
      const corruptStatus = async route => {
        if (route.request().postDataJSON()?.p_operation !== "status") return route.fallback();
        corruptedReads++;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ contract: "unexpected-catalogue-state", eligible: true, items: [] }) });
      };
      await page.route(rpcUrl, corruptStatus);
      await refresh();
      await manager.getByTestId("catalogue-unavailable").waitFor({ state: "visible" });
      assert.equal(await manager.getByTestId("catalogue-empty").count(), 0);
      assert.equal(await manager.getByTestId("catalogue-ineligible").count(), 0);
      assert.equal(corruptedReads, 1);
      assert.equal(submissionCount(), beforeUnavailable);
      await capture(manager.getByTestId("catalogue-unavailable"), "unavailable");
      await page.unroute(rpcUrl, corruptStatus);
      await refresh();
      await card(uploaded.catalog_id).waitFor({ state: "visible" });
      assert.equal((await status()).items.length, beforeUnavailable);

      assert.equal(await manager.getByTestId("producer-structured-moderation").count(), 0);
      assert.equal(await manager.getByTestId("pdf-row-owner").count(), 0);
      await manager.getByRole("button", { name: "Rivedi dati estratti", exact: true }).click();
      await manager.getByTestId("producer-structured-moderation").waitFor({ state: "visible" });
      await manager.getByTestId("pdf-row-owner").waitFor({ state: "visible" });
      await capture(manager.getByTestId("producer-structured-moderation"), "review-entry");

      setPublication("pending_review");
      assert.equal((await status()).eligible, false);
      await page.reload({ waitUntil: "domcontentloaded" });
      await manager.getByTestId("catalogue-ineligible").waitFor({ state: "visible", timeout: 30000 });
      assert.equal(await manager.getByTestId("company-catalogue-card").count(), 0);
      assert.equal(await manager.getByTestId("catalogue-empty").count(), 0);
      assert.equal(await manager.getByTestId("producer-catalogue-form").count(), 0);
      await capture(manager.getByTestId("catalogue-ineligible"), "ineligible");
      setPublication("published");

      if (width === 1440) {
        for (let index = 0; index < 21; index++) seedCatalogue("limite " + index, "not_verified", "pending_provenance");
        assert.equal((await status()).items.length, 20);
        await page.goto(base + "/network/manage/cataloghi", { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForURL(url => url.pathname === "/company/profile" && url.hash === "#products-catalogues", { timeout: 30000 });
        await manager.getByTestId("company-catalogue-card").nth(19).waitFor({ state: "visible", timeout: 30000 });
        assert.equal(await manager.getByTestId("company-catalogue-card").count(), 20);
        assert.match(await manager.innerText(), /20[^\n]*recenti|recenti[^\n]*20/);
        await capture(manager.getByRole("heading", { name: "Cataloghi e documenti tecnici", exact: true }), "loaded-limit-20");
      }
      assert.deepEqual(errors, [], "Uncaught D.2 browser errors at " + width);
      assert.deepEqual([...new Set(consoleIssues)], [], "D.2 console issues at " + width);
      console.log("COMPANY-UX2.D.2 Chrome PASS", width, "cancel, real private " + uploaded.format + " upload and source readback, declared/active/expired/revoked rights, confirmed withdrawal, stale derived data, read recovery and eligibility");
    } catch (error) {
      if (page && !page.isClosed()) {
        try {
          console.error("D.2 case failure", JSON.stringify({ width,
            path: new URL(page.url()).pathname + new URL(page.url()).hash,
            workspace: (await page.getByTestId("company-catalogue-workspace").innerText()).slice(0, 6500),
            errors: errors.slice(-8), consoleIssues: consoleIssues.slice(-8).map(value => value.slice(0, 1600)),
          }));
          await page.screenshot({ path: path.join(output, "company-ux2d2-failed-" + width + ".png"), fullPage: true, animations: "disabled", caret: "initial", timeout: 10000 });
        } catch (diagnosticError) {
          console.error("D.2 diagnostic unavailable", String(diagnosticError).slice(0, 400));
        }
      }
      throw error;
    } finally {
      setPublication(originalCompany.publication_status);
      clearSubmissions();
      await context.close();
    }
  }
} finally {
  await browser.close();
  await admin.auth.signOut();
}
