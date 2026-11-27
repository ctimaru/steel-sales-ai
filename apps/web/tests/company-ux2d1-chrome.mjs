/** D.1: real inventory lifecycle and visibility on the disposable Company localhost fixture. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
assert.ok(owner && viewer && otherTenant && otherTenant.org !== owner.org);
const companyId = "00000000-0000-4000-8000-000000026160";
const output = path.join(process.env.RUNNER_TEMP, "netro14d-synthetic-visual");
mkdirSync(output, { recursive: true });
const options = { auth: { persistSession: false, autoRefreshToken: false } };
async function signed(person) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
  const result = await client.auth.signInWithPassword({ email: person.email, password: person.password });
  assert.ifError(result.error);
  return client;
}
const admin = await signed(owner);
const viewerClient = await signed(viewer);
const readArgs = { p_organization_id: owner.org, p_company_id: companyId };
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
function eventCount() {
  return Number(localSql("SELECT count(*) FROM private.netprofile_ux1b_events WHERE company_id=" + sqlString(companyId) + ";"));
}
function setPublication(status) {
  assert.ok(["published", "pending_review"].includes(status));
  fixtureSql("UPDATE public.network_companies SET publication_status=" + sqlString(status) + " WHERE id=" + sqlString(companyId) + ";");
}
const originalCompany = sqlJson("(SELECT jsonb_build_object('publication_status',publication_status,'website_url',website_url) FROM public.network_companies WHERE id=" + sqlString(companyId) + ")");
assert.equal(originalCompany.website_url, "https://company-ux2.example.test", "D.1 must use the preceding synthetic Company fixture");
assert.equal(originalCompany.publication_status, "published");
async function rows(rpc = "netprofile_ux1b_manage") {
  const { data, error } = await admin.rpc(rpc, readArgs);
  assert.ifError(error);
  assert.ok(Array.isArray(data), rpc + " must return rows");
  assert.ok(data.every(item => item.company_id === companyId && item.provenance === "company_declared"));
  return data;
}
async function item(id) {
  const result = (await rows()).find(row => row.id === id);
  assert.ok(result, "Managed inventory item required: " + id);
  return result;
}
function writeArgs(record, overrides = {}) {
  return {
    ...readArgs, p_item_id: record.id ?? null, p_kind: record.kind ?? "stock",
    p_product_name: record.product_name, p_standard: record.standard ?? null,
    p_grade: record.grade ?? null, p_dimensions: record.dimensions ?? null,
    p_quantity: record.quantity, p_unit: record.unit ?? "t", p_location: record.location ?? null,
    p_available_on: record.available_on ?? null, p_publication_status: record.publication_status ?? "draft",
    ...overrides,
  };
}
async function write(record, overrides = {}) {
  const result = await admin.rpc("netprofile_ux1b_upsert", writeArgs(record, overrides));
  assert.ifError(result.error);
  assert.ok(result.data?.id);
  return result.data.id;
}
async function archiveAll() {
  const current = await rows();
  for (const record of current) await write(record, { p_publication_status: "archived" });
  assert.equal((await rows()).length, 0, "The three-width cases must start with an empty managed inventory");
  assert.equal((await rows("netprofile_ux1b_public")).length, 0);
}
assert.equal((await rows()).length, 0, "Earlier Company suites must not have populated inventory");
const beforeDenied = eventCount();
const deniedRecord = { product_name: "DEMO D1 forbidden write", quantity: 1 };
for (const [client, rpc, parameters] of [
  [viewerClient, "netprofile_ux1b_manage", readArgs],
  [viewerClient, "netprofile_ux1b_upsert", writeArgs(deniedRecord)],
  [admin, "netprofile_ux1b_manage", { ...readArgs, p_organization_id: otherTenant.org }],
  [admin, "netprofile_ux1b_upsert", writeArgs(deniedRecord, { p_organization_id: otherTenant.org })],
]) {
  const result = await client.rpc(rpc, parameters);
  assert.equal(result.error?.code, "42501", "Viewer/wrong organization denied by " + rpc);
}
assert.equal((await rows()).length, 0);
assert.equal(eventCount(), beforeDenied, "Denied requests must not write an audit event");
await viewerClient.auth.signOut();
const todayUtc = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
const future = days => new Date(todayUtc + days * 86400000).toISOString().slice(0, 10);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 }, locale: "it-IT",
      reducedMotion: "reduce", serviceWorkers: "block",
    });
    let page;
    const errors = [];
    const consoleIssues = [];
    try {
      await context.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        const content = message.text();
        if (message.type() !== "error" && !(message.type() === "warning" && /hydration|validateDOMNesting|same key|cannot specify.*form|each child in a list/i.test(content))) return;
        const source = message.location().url;
        if (/Failed to load resource/i.test(content) && /^https?:/.test(source) && !["127.0.0.1", "localhost"].includes(new URL(source).hostname)) return;
        consoleIssues.push(content.slice(0, 24000));
      });
      await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.locator('input[name="email"]').fill(owner.email);
      await page.locator('input[name="password"]').fill(owner.password);
      await page.getByRole("button", { name: "Accedi", exact: true }).click();
      await page.waitForURL(url => url.pathname === "/dashboard", { timeout: 90000 });
      const response = await page.goto(base + "/company/profile#stock", { waitUntil: "domcontentloaded", timeout: 90000 });
      assert.equal(response?.status(), 200);
      const workspace = page.getByTestId("company-workspace");
      const manager = page.getByTestId("network-stock-manager");
      const editor = manager.getByTestId("stock-editor");
      const form = manager.getByTestId("network-stock-form");
      const card = id => manager.locator('[data-testid="stock-card"][data-item-id="' + id + '"]');
      await manager.waitFor({ state: "visible", timeout: 30000 });
      assert.equal(await workspace.locator('[id^="company-panel-"]:visible').count(), 1);
      assert.equal(await workspace.getByRole("navigation", { name: "Gestione azienda" }).locator('[aria-current="page"]').getAttribute("href"), "#stock");
      async function capture(target, name, full = false) {
        const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(metrics.scroll <= metrics.width + 2, "D1 overflow " + name + " at " + width + ": " + JSON.stringify(metrics));
        const stem = path.join(output, "company-ux2d1-" + name);
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
      async function openNew() {
        await manager.getByRole("button", { name: "Aggiungi disponibilità", exact: true }).click();
        await editor.waitFor({ state: "visible" });
        assert.equal(await form.getAttribute("data-item-id"), "new");
      }
      async function edit(id) {
        await card(id).getByRole("button", { name: "Modifica disponibilità", exact: true }).click();
        await editor.waitFor({ state: "visible" });
        assert.equal(await form.getAttribute("data-item-id"), id);
      }
      async function fill(values) {
        for (const [name, value] of Object.entries(values)) {
          const field = form.locator('[name="' + name + '"]');
          if (["kind", "unit"].includes(name)) await field.selectOption(value);
          else await field.fill(String(value));
        }
      }
      async function values() {
        return form.locator("input:not([type=hidden]),select").evaluateAll(fields => Object.fromEntries(fields.map(field => [field.name, field.value])));
      }
      async function expectFocus(locator) {
        await locator.and(page.locator(":focus")).waitFor({ state: "visible", timeout: 30000 });
        assert.equal(await locator.evaluate(element => element === document.activeElement), true);
      }
      async function save(label) {
        await form.getByRole("button", { name: label, exact: true }).click();
        await editor.waitFor({ state: "hidden", timeout: 30000 });
        await expectFocus(manager.locator('[data-testid="stock-feedback"][role="status"]'));
      }
      async function expectCard(id, state) {
        await card(id).waitFor({ state: "visible", timeout: 30000 });
        await page.waitForFunction(({ id, state }) => document.querySelector('[data-testid="stock-card"][data-item-id="' + id + '"]')?.getAttribute("data-publication-status") === state, { id, state }, { timeout: 30000 });
      }
      async function resetFilters() {
        await manager.getByRole("button", { name: "Azzera filtri", exact: true }).click();
      }
      async function expectVisibleIds(ids) {
        await page.waitForFunction(expected => {
          const visible = [...document.querySelectorAll('[data-testid="network-stock-manager"] [data-testid="stock-card"]')]
            .map(element => element.getAttribute("data-item-id")).sort();
          return JSON.stringify(visible) === JSON.stringify(expected);
        }, [...ids].sort(), { timeout: 30000 });
        assert.deepEqual((await manager.getByTestId("stock-card").evaluateAll(elements => elements.map(element => element.getAttribute("data-item-id")))).sort(), [...ids].sort());
      }
      assert.equal(await manager.getByTestId("stock-card").count(), 0);
      await manager.getByTestId("stock-empty").waitFor({ state: "visible" });
      await capture(manager, "empty");
      const newCancelEvents = eventCount();
      await openNew();
      await fill({ product_name: "DEMO D1 nuova disponibilità da annullare", quantity: "1" });
      await form.getByRole("button", { name: "Annulla", exact: true }).click();
      await editor.waitFor({ state: "hidden" });
      await expectFocus(manager.getByRole("button", { name: "Aggiungi disponibilità", exact: true }));
      assert.equal((await rows()).length, 0, "Cancel a new editor must not create a draft");
      assert.equal(eventCount(), newCancelEvents);
      await openNew();
      await fill({ kind: "stock", product_name: "DEMO D1 Tubo tondo " + width, standard: "EN 10219", grade: "S355J2H", dimensions: "Ø 323,9 × 6,3 · L.12 m", quantity: "12.5", unit: "t", location: "DEMO magazzino Torino" });
      await capture(editor, "new-draft", true);
      await save("Salva bozza privata");
      const stock = (await rows()).find(row => row.product_name === "DEMO D1 Tubo tondo " + width);
      assert.ok(stock);
      assert.equal(stock.publication_status, "draft");
      assert.equal(Number(stock.quantity), 12.5);
      assert.equal(stock.unit, "t");
      assert.equal((await rows("netprofile_ux1b_public")).length, 0);
      await expectCard(stock.id, "draft");

      const beforeCancel = await item(stock.id);
      const cancelEvents = eventCount();
      await edit(stock.id);
      await fill({ product_name: "DEMO D1 modifiche da annullare", quantity: "99.125", unit: "pcs" });
      await form.getByRole("button", { name: "Annulla", exact: true }).click();
      await editor.waitFor({ state: "hidden" });
      await expectFocus(card(stock.id).getByRole("button", { name: "Modifica disponibilità", exact: true }));
      assert.deepEqual(await item(stock.id), beforeCancel, "Cancel must leave every persisted field unchanged");
      assert.equal(eventCount(), cancelEvents, "Cancel must not save or audit");
      await edit(stock.id);
      assert.equal(await form.locator('[name="product_name"]').inputValue(), beforeCancel.product_name);
      assert.equal(await form.locator('[name="quantity"]').inputValue(), "12.5");
      assert.equal(await form.locator('[name="unit"]').inputValue(), "t");
      await fill({ quantity: "14.75" });
      await save("Salva bozza privata");
      assert.equal(Number((await item(stock.id)).quantity), 14.75);
      await edit(stock.id);
      assert.equal(await form.locator('[name="quantity"]').inputValue(), "14.75", "Reopening after refresh must use the saved record");
      await save("Pubblica nel Network");
      await expectCard(stock.id, "published");
      assert.deepEqual((await rows("netprofile_ux1b_public")).map(row => row.id), [stock.id]);
      await edit(stock.id);
      await fill({ product_name: "DEMO D1 Tubo aggiornato " + width, quantity: "15.125" });
      await save("Aggiorna pubblicazione");
      assert.equal(Number((await item(stock.id)).quantity), 15.125);
      const publishedStock = (await rows("netprofile_ux1b_public")).find(row => row.id === stock.id);
      assert.equal(publishedStock?.product_name, "DEMO D1 Tubo aggiornato " + width);
      assert.equal(Number(publishedStock?.quantity), 15.125);

      await openNew();
      await fill({ kind: "incoming", product_name: "DEMO D1 Lamiera in arrivo " + width, standard: "EN 10149", grade: "S355MC", dimensions: "1500 × 3000 × 8 mm", quantity: "750", unit: "kg", location: "DEMO centro logistico con descrizione estesa per la verifica mobile", available_on: "" });
      const incomingDraft = await values();
      const errorEvents = eventCount();
      await form.getByRole("button", { name: "Pubblica nel Network", exact: true }).click();
      await editor.getByRole("alert").waitFor({ state: "visible", timeout: 30000 });
      await expectFocus(editor.getByRole("alert"));
      assert.match(await editor.getByRole("alert").innerText(), /data/i);
      assert.deepEqual(await values(), incomingDraft, "Server validation must preserve all visible selections and inputs");
      assert.equal((await rows()).length, 1);
      assert.equal(eventCount(), errorEvents, "Rejected incomplete publication must not save or audit");
      await capture(editor, "date-error", true);
      await capture(editor.getByRole("alert"), "date-error-feedback");
      await fill({ available_on: future(7) });
      await save("Pubblica nel Network");
      const incoming = (await rows()).find(row => row.product_name === incomingDraft.product_name);
      assert.ok(incoming);
      assert.equal(incoming.kind, "incoming");
      assert.equal(incoming.available_on, future(7));
      assert.equal(incoming.unit, "kg");
      await expectCard(incoming.id, "published");
      const productionId = await write({ kind: "production", product_name: "DEMO D1 Profilati programmati " + width, standard: "EN 10210", grade: "S355J2H", quantity: 260, unit: "m", available_on: future(14), location: "DEMO reparto produzione", publication_status: "draft" });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectCard(productionId, "draft");
      assert.equal(await manager.getByTestId("stock-card").count(), 3);
      assert.equal((await rows("netprofile_ux1b_public")).length, 2);
      for (const [id, kind, unit] of [[stock.id, "stock", "t"], [incoming.id, "incoming", "kg"], [productionId, "production", "m"]]) {
        assert.equal(await card(id).getAttribute("data-kind"), kind);
        assert.match(await card(id).innerText(), new RegExp("\\b" + unit + "\\b"));
      }
      assert.match(await card(incoming.id).innerText(), /arriv/i);
      assert.match(await card(productionId).innerText(), /produzione|programmat/i);
      for (const [kind, label] of [["stock", "A magazzino"], ["incoming", "In arrivo"], ["production", "Produzioni"]]) {
        const metric = await manager.getByTestId("stock-metric-" + kind).innerText();
        assert.ok(metric.includes(label));
        assert.match(metric, /\b1\b/, "Each availability metric must count records independently of their different units");
      }
      assert.match(await manager.innerText(), /2 pubblicate/);
      assert.match(await manager.innerText(), /1 bozza privata/);
      for (const [id, date] of [[incoming.id, future(7)], [productionId, future(14)]]) {
        const expectedDate = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T00:00:00Z"));
        assert.ok((await card(id).innerText()).includes(expectedDate), "Availability date must remain visible on the compact card");
      }
      await capture(manager, "populated", true);

      await manager.getByLabel("Cerca disponibilità", { exact: true }).fill("S355MC");
      await manager.getByLabel("Filtra per tipo", { exact: true }).selectOption("incoming");
      await manager.getByLabel("Filtra per visibilità", { exact: true }).selectOption("published");
      await expectVisibleIds([incoming.id]);
      await manager.getByLabel("Cerca disponibilità", { exact: true }).fill("DEMO nessuna disponibilità corrispondente");
      await manager.getByTestId("stock-filter-empty").waitFor({ state: "visible" });
      assert.equal(await manager.getByTestId("stock-card").count(), 0);
      await capture(manager, "filter-empty");
      await resetFilters();
      await expectVisibleIds([stock.id, incoming.id, productionId]);
      assert.equal(await manager.getByLabel("Cerca disponibilità", { exact: true }).inputValue(), "");
      assert.equal(await manager.getByLabel("Filtra per tipo", { exact: true }).inputValue(), "all");
      assert.equal(await manager.getByLabel("Filtra per visibilità", { exact: true }).inputValue(), "all");
      await manager.getByLabel("Filtra per visibilità", { exact: true }).selectOption("draft");
      await expectVisibleIds([productionId]);
      await edit(productionId);
      await fill({ quantity: "999" });
      const filterDraft = await values();
      const filterEvents = eventCount();
      await manager.getByLabel("Cerca disponibilità", { exact: true }).fill("DEMO filtro senza risultati");
      await expectVisibleIds([]);
      assert.equal(await editor.isVisible(), true, "Filters must not unmount an active editor");
      assert.deepEqual(await values(), filterDraft);
      await form.getByRole("button", { name: "Annulla", exact: true }).click();
      await editor.waitFor({ state: "hidden" });
      await expectFocus(manager.getByRole("button", { name: "Aggiungi disponibilità", exact: true }));
      assert.equal(Number((await item(productionId)).quantity), 260);
      assert.equal(eventCount(), filterEvents);
      await resetFilters();
      await expectVisibleIds([stock.id, incoming.id, productionId]);

      await edit(stock.id);
      await save("Rendi privata");
      await expectCard(stock.id, "draft");
      assert.equal((await rows("netprofile_ux1b_public")).some(row => row.id === stock.id), false);
      await edit(stock.id);
      await save("Archivia");
      await card(stock.id).waitFor({ state: "hidden", timeout: 30000 });
      assert.equal((await rows()).some(row => row.id === stock.id), false);
      assert.equal((await rows("netprofile_ux1b_public")).some(row => row.id === stock.id), false);
      const auditedActions = sqlJson("(SELECT jsonb_agg(action ORDER BY id) FROM private.netprofile_ux1b_events WHERE item_id=" + sqlString(stock.id) + ")");
      assert.deepEqual(auditedActions, ["create", "update", "publish", "update", "unpublish", "archive"]);

      // One real writer denial after opening an editor checks SQL-error recovery,
      // independently of the earlier date validation performed by the server action.
      if (width === 1440) {
        const beforeWriterDenied = await item(productionId);
        const writerEvents = eventCount();
        await edit(productionId);
        await fill({ quantity: "888.125", available_on: future(21) });
        const rejectedValues = await values();
        assert.equal(await form.getByRole("button", { name: "Pubblica nel Network", exact: true }).isEnabled(), true);
        setPublication("pending_review");
        await form.getByRole("button", { name: "Pubblica nel Network", exact: true }).click();
        await editor.getByRole("alert").waitFor({ state: "visible", timeout: 30000 });
        await expectFocus(editor.getByRole("alert"));
        assert.match(await editor.getByRole("alert").innerText(), /permessi/i);
        assert.deepEqual(await values(), rejectedValues, "A real SQL denial must preserve the editor inputs");
        assert.deepEqual(await item(productionId), beforeWriterDenied);
        assert.equal(eventCount(), writerEvents, "SQL denial must roll back the inventory and audit write");
        await capture(editor.getByRole("alert"), "writer-error-feedback");
        await form.getByRole("button", { name: "Annulla", exact: true }).click();
        await editor.waitFor({ state: "hidden" });
        await expectFocus(card(productionId).getByRole("button", { name: "Modifica disponibilità", exact: true }));
      }

      setPublication("pending_review");
      await page.reload({ waitUntil: "domcontentloaded" });
      await manager.getByTestId("network-stock-publishing-wait").waitFor({ state: "visible" });
      assert.equal((await rows("netprofile_ux1b_public")).length, 0, "A company pending review hides all published inventory");
      await capture(manager.getByTestId("network-stock-publishing-wait"), "publishing-wait");
      await openNew();
      await fill({ kind: "production", product_name: "DEMO D1 Bozza durante revisione " + width, quantity: "33", unit: "bars", available_on: "" });
      assert.equal(await form.getByRole("button", { name: "Pubblica nel Network", exact: true }).isDisabled(), true);
      assert.equal(await form.getByRole("button", { name: "Salva bozza privata", exact: true }).isEnabled(), true);
      await capture(editor, "pending-review", true);
      await save("Salva bozza privata");
      const pendingDraft = (await rows()).find(row => row.product_name === "DEMO D1 Bozza durante revisione " + width);
      assert.ok(pendingDraft);
      assert.equal(pendingDraft.publication_status, "draft");
      await expectCard(pendingDraft.id, "draft");
      assert.match(await card(pendingDraft.id).innerText(), /33\s*barre/);
      const beforePublishDenied = eventCount();
      const publishDenied = await admin.rpc("netprofile_ux1b_upsert", writeArgs(pendingDraft, { p_available_on: future(21), p_publication_status: "published" }));
      assert.equal(publishDenied.error?.code, "42501");
      assert.deepEqual(await item(pendingDraft.id), pendingDraft);
      assert.equal(eventCount(), beforePublishDenied);
      setPublication("published");
      await archiveAll();

      // One bounded desktop case proves the reader/UI ceiling without hundreds of captures.
      if (width === 1440) {
        fixtureSql("INSERT INTO private.netprofile_ux1b_inventory " +
          "(company_id,organization_id,kind,product_name,quantity,unit,publication_status,created_by,updated_by,updated_at) " +
          "SELECT " + [companyId, owner.org].map(sqlString).join(",") + ",'stock','DEMO D1 limite '||lpad(n::text,3,'0'),1,'pcs','draft'," +
          [owner.userId, owner.userId].map(sqlString).join(",") + ",now()-n*interval '1 second' FROM generate_series(1,101) n;");
        assert.equal((await rows()).length, 100, "Managed RPC remains bounded to 100 positions");
        await page.reload({ waitUntil: "domcontentloaded" });
        await manager.getByTestId("stock-card").nth(99).waitFor({ state: "visible" });
        assert.equal(await manager.getByTestId("stock-card").count(), 100);
        assert.match(await manager.innerText(), /Mostrate le 100 posizioni più recenti/, "The UI must describe the reader ceiling, not imply a complete inventory total");
        assert.match(await manager.getByTestId("stock-card").first().innerText(), /1\s*pz/);
        await capture(manager.getByTestId("stock-metrics"), "loaded-limit-100");
        fixtureSql("UPDATE private.netprofile_ux1b_inventory SET publication_status='archived',published_at=null WHERE company_id=" + sqlString(companyId) + " AND organization_id=" + sqlString(owner.org) + " AND product_name LIKE 'DEMO D1 limite %';");
        assert.equal((await rows()).length, 0);
      }
      assert.deepEqual(errors, [], "Uncaught D.1 browser errors at " + width);
      assert.deepEqual([...new Set(consoleIssues)], [], "D.1 console issues at " + width);
      console.log("COMPANY-UX2.D.1 Chrome PASS", width, "draft create/edit/cancel, preserved validation error, publish/update/private/archive, filters, mixed units, pending-review and readback");
    } catch (error) {
      if (page && !page.isClosed()) {
        try {
          console.error("D.1 case failure", JSON.stringify({ width,
            path: new URL(page.url()).pathname + new URL(page.url()).hash,
            manager: (await page.getByTestId("network-stock-manager").innerText()).slice(0, 5000),
            fields: await page.getByTestId("network-stock-form").locator("input:not([type=hidden]),select").evaluateAll(fields => fields.map(field => ({ name: field.name, value: field.value, disabled: field.matches(":disabled") }))),
            errors: errors.slice(-8), consoleIssues: consoleIssues.slice(-8).map(value => value.slice(0, 1600)),
          }));
          await page.screenshot({ path: path.join(output, "company-ux2d1-failed-" + width + ".png"), fullPage: true, animations: "disabled", caret: "initial", timeout: 10000 });
        } catch (diagnosticError) {
          console.error("D.1 diagnostic unavailable", String(diagnosticError).slice(0, 400));
        }
      }
      throw error;
    } finally {
      setPublication(originalCompany.publication_status);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await admin.auth.signOut();
}
