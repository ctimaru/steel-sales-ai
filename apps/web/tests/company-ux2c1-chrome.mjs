/** C.1 end-to-end decisions against disposable localhost data only. */
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
assert.ok(owner && viewer);
const companyId = "00000000-0000-4000-8000-000000026160";
const companyWebsite = "https://company-ux2.example.test";
const sources = [companyWebsite + "/azienda", companyWebsite + "/competenze/" + "lavorazioni-industriali-".repeat(8)];
const output = path.join(process.env.RUNNER_TEMP, "netro14d-synthetic-visual");
mkdirSync(output, { recursive: true });
const options = { auth: { persistSession: false, autoRefreshToken: false } };
async function signed(person) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
  const { error } = await client.auth.signInWithPassword({ email: person.email, password: person.password });
  assert.ifError(error);
  return client;
}
const admin = await signed(owner);
const args = { p_organization_id: owner.org, p_network_company_id: companyId };
async function review() {
  const { data, error } = await admin.rpc("company_ux2c1_description_review", args);
  assert.ifError(error);
  assert.equal(data?.contract, "company-ux2c1-description-v1");
  return data;
}
// SQL is confined to this runner's local database and the company created by
// company-ux2a-chrome. Production routes and credentials are never accepted.
const sqlString = value => "'" + String(value).replaceAll("'", "''") + "'";
function fixtureSql(statement) {
  execFileSync("psql", ["--host", "127.0.0.1", "--port", "54322", "--username", "postgres", "--dbname", "postgres", "--set", "ON_ERROR_STOP=1", "--quiet"], {
    input: "BEGIN;\n" + statement + "\nCOMMIT;\n",
    env: { ...process.env, PGPASSWORD: "postgres" }, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  });
}
function seedResearch(summary) {
  if (summary === null) {
    fixtureSql(`DELETE FROM private.network_company_research WHERE company_id = '${companyId}';`);
    return;
  }
  fixtureSql(`INSERT INTO private.network_company_research
    (company_id,status,summary,activities,products,sectors,source_urls,extractor_version,model,researched_at,published_at)
    VALUES ('${companyId}','published',${sqlString(summary)},ARRAY['Lavorazioni industriali DEMO'],ARRAY['Tubi sintetici DEMO'],ARRAY['Meccanica DEMO'],
      ARRAY[${sources.map(sqlString).join(",")}],'c1-local-fixture-v1','synthetic-test-only',now(),'2026-11-27T09:00:00Z')
    ON CONFLICT (company_id) DO UPDATE SET status=excluded.status,summary=excluded.summary,
      activities=excluded.activities,products=excluded.products,sectors=excluded.sectors,
      source_urls=excluded.source_urls,extractor_version=excluded.extractor_version,model=excluded.model,
      researched_at=excluded.researched_at,published_at=excluded.published_at;`);
}
function summaryFor(width, scenario) {
  return `DEMO ${width} ${scenario}. Azienda sintetica specializzata nella fornitura di tubi e nelle lavorazioni industriali, con un’offerta destinata alla meccanica e alla costruzione. Test locale di revisione della descrizione assistita.`;
}
async function manualUpdate(description) {
  const current = await review();
  const { error } = await admin.rpc("company_ux2c1_update_overview", {
    ...args, p_expected_description_hash: current.current_description_hash,
    p_trading_name: null, p_website_url: companyWebsite, p_description: description,
  });
  assert.ifError(error);
}
const viewerClient = await signed(viewer);
for (const [rpc, params] of [
  ["company_ux2c1_description_review", args],
  ["company_ux2c1_decide_description", { ...args, p_expected_proposal_hash: "a".repeat(64), p_expected_description_hash: "b".repeat(64), p_action: "ignore" }],
  ["company_ux2c1_update_overview", { ...args, p_expected_description_hash: "b".repeat(64), p_description: "Denied" }],
]) {
  const { error } = await viewerClient.rpc(rpc, params);
  assert.equal(error?.code, "42501", "Viewer denied by " + rpc);
}
await viewerClient.auth.signOut();

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [1440, 390, 320]) {
    seedResearch(null);
    await manualUpdate(width === 320 ? null : "DEMO descrizione attuale dell’azienda, inserita dal team commerciale.");
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 }, locale: "it-IT", reducedMotion: "reduce", serviceWorkers: "block" });
    try {
      await context.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors = [];
      const consoleIssues = [];
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
      const assistant = page.getByTestId("company-description-assistant");
      async function open() {
        const response = await page.goto(base + "/company/profile#overview", { waitUntil: "domcontentloaded", timeout: 90000 });
        // Moving from the manual field's fragment to #overview is a same-document
        // navigation. Reload to observe fixture changes made outside the page.
        if (!response) await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
        await assistant.waitFor({ state: "visible", timeout: 30000 });
      }
      async function state(expected) {
        try {
          await page.waitForFunction(value => document.querySelector('[data-testid="company-description-assistant"]')?.getAttribute("data-state") === value, expected, { timeout: 30000 });
        } catch (error) {
          console.error("C1 state failure", { width, expected, actual: await assistant.getAttribute("data-state"), availability: await assistant.getAttribute("data-availability"), text: (await assistant.innerText()).slice(0, 1200), consoleIssues, errors });
          await page.screenshot({ path: path.join(output, "company-ux2c1-failed-" + expected + "-" + width + ".png"), fullPage: true, animations: "disabled", caret: "initial" });
          throw error;
        }
      }
      async function capture(name) {
        const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(metrics.scroll <= metrics.width + 2, "C1 overflow " + name + " at " + width + ": " + JSON.stringify(metrics));
        // A tall locator screenshot can place offscreen fixed shell elements over
        // the component. Keep the real shell and capture the page from its top.
        await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
        await page.screenshot({ path: path.join(output, "company-ux2c1-" + name + "-" + width + ".png"), fullPage: true, animations: "disabled", caret: "initial" });
        if (!["proposal", "editing", "stale"].includes(name)) return;

        // Measure the sticky header and fixed mobile navigation, including their
        // safe-area padding, instead of assuming breakpoint-specific heights.
        await assistant.evaluate(element => {
          const headerHeight = document.querySelector("header.sticky")?.getBoundingClientRect().height ?? 0;
          const top = window.scrollY + element.getBoundingClientRect().top - headerHeight - 16;
          window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "instant" });
        });
        await page.screenshot({ path: path.join(output, "company-ux2c1-" + name + "-top-" + width + ".png"), animations: "disabled", caret: "initial" });

        const needsActionsView = await assistant.evaluate(element => {
          const navigationHeight = document.querySelector('nav[aria-label="Navigazione mobile principale"]')?.getBoundingClientRect().height ?? 0;
          const visibleBottom = window.innerHeight - navigationHeight - 16;
          const remaining = element.getBoundingClientRect().bottom - visibleBottom;
          if (remaining <= 2) return false;
          window.scrollBy({ top: remaining, left: 0, behavior: "instant" });
          return true;
        });
        // The top view already covers the actions when the component fits.
        if (needsActionsView) {
          await page.screenshot({ path: path.join(output, "company-ux2c1-" + name + "-actions-" + width + ".png"), animations: "disabled", caret: "initial" });
        }
      }
      await open();
      await state("no_research");
      await capture("empty");
      await assistant.getByRole("link", { name: /descrizione aziendale/ }).click();
      await page.locator("#company-description:focus").waitFor({ state: "visible" });

      const acceptedText = summaryFor(width, "accettazione");
      seedResearch(acceptedText);
      assert.equal((await review()).availability, "available", "New seeded research must be available before refreshing the UI");
      await open();
      await state("available");
      assert.ok((await assistant.getByTestId("company-description-proposal").innerText()).includes(acceptedText));
      const evidence = assistant.getByTestId("company-description-sources");
      await evidence.locator("summary").click();
      assert.deepEqual(await evidence.locator("a").evaluateAll(nodes => nodes.map(node => node.href)), sources);
      await capture("proposal");
      if (width === 1440) await page.getByTestId("company-overview-form").locator('input[name="trading_name"]').fill("DEMO nome commerciale non ancora salvato");
      const staleManual = width === 1440 ? await context.newPage() : null;
      if (staleManual) {
        await staleManual.goto(base + "/company/profile#overview", { waitUntil: "domcontentloaded" });
        await staleManual.getByTestId("company-overview-form").waitFor({ state: "visible" });
      }
      await assistant.getByTestId("company-description-accept").click();
      await state("accepted");
      assert.equal((await review()).current_description, acceptedText);
      assert.equal(await page.locator("#company-description").inputValue(), acceptedText, "Manual editor must reflect confirmed text");
      if (width === 1440) assert.equal(await page.getByTestId("company-overview-form").locator('input[name="trading_name"]').inputValue(), "DEMO nome commerciale non ancora salvato", "Accepting a description preserves unsaved identity edits");
      await capture("accepted");
      await open();
      await state("accepted");
      assert.equal(await assistant.getByTestId("company-description-accept").count(), 0);
      if (staleManual) {
        await staleManual.locator("#company-description").fill("DEMO stale tab must not overwrite confirmed proposal.");
        await staleManual.getByRole("button", { name: "Salva overview", exact: true }).click();
        await staleManual.waitForURL(url => url.searchParams.has("error"), { timeout: 90000 });
        assert.match(new URL(staleManual.url()).searchParams.get("error"), /altra sessione/);
        assert.equal((await review()).current_description, acceptedText);
        await staleManual.close();
      }
      const publicPage = await context.newPage();
      await publicPage.goto(base + "/network/" + companyId, { waitUntil: "domcontentloaded", timeout: 90000 });
      const declared = publicPage.getByTestId("network-company-declared-description");
      await declared.waitFor({ state: "visible", timeout: 30000 });
      assert.ok((await declared.innerText()).includes(acceptedText));
      assert.equal(await publicPage.getByTestId("network-research-summary").count(), 0, "Confirmed description must not duplicate research summary");
      assert.match(await publicPage.getByTestId("network-research-facts").innerText(), /Tubi sintetici DEMO/);
      await publicPage.screenshot({ path: path.join(output, "company-ux2c1-public-" + width + ".png"), fullPage: true, animations: "disabled", caret: "initial" });
      await publicPage.close();

      seedResearch(summaryFor(width, "modifica"));
      await open();
      await state("available");
      await assistant.getByTestId("company-description-edit").click();
      const draft = assistant.getByTestId("company-description-draft");
      const editedText = `DEMO ${width}. Descrizione rielaborata dall’azienda: forniamo tubi e servizi di lavorazione per i clienti industriali.`;
      await draft.fill(editedText);
      await capture("editing");
      await manualUpdate(`DEMO ${width}. Descrizione aggiornata da una seconda sessione prima della conferma.`);
      await assistant.getByTestId("company-description-save").click();
      await assistant.getByTestId("company-description-refresh").waitFor({ state: "visible" });
      assert.equal(await draft.inputValue(), editedText);
      assert.equal(await assistant.getByTestId("company-description-save").isDisabled(), true);
      await capture("stale");
      await assistant.getByTestId("company-description-refresh").click();
      await page.waitForFunction(() => {
        const button = document.querySelector('[data-testid="company-description-save"]');
        return button instanceof HTMLButtonElement && !button.disabled;
      }, null, { timeout: 30000 });
      assert.equal(await draft.inputValue(), editedText);
      assert.match(await assistant.getByTestId("company-description-current").innerText(), /seconda sessione/);
      await assistant.getByTestId("company-description-save").click();
      await state("edited");
      assert.equal((await review()).current_description, editedText);
      await capture("edited");

      seedResearch(summaryFor(width, "ignorata"));
      await open();
      await state("available");
      await assistant.getByTestId("company-description-ignore").click();
      await state("ignored");
      assert.equal((await review()).current_description, editedText);
      fixtureSql(`UPDATE private.network_company_research SET researched_at=now()+interval '1 day', last_error='local_failed_refresh' WHERE company_id='${companyId}';`);
      await open();
      await state("ignored");
      assert.equal(await assistant.getByTestId("company-description-accept").count(), 0, "Identical ignored text stays dismissed after timestamp refresh");
      await capture("ignored");

      if (width === 1440) {
        seedResearch(summaryFor(width, "versione precedente"));
        await open();
        await assistant.getByTestId("company-description-edit").click();
        await draft.fill(editedText + " Bozza preservata dopo nuova ricerca.");
        seedResearch(summaryFor(width, "versione successiva"));
        await assistant.getByTestId("company-description-save").click();
        await assistant.getByTestId("company-description-refresh").waitFor({ state: "visible" });
        assert.equal((await review()).current_description, editedText, "Stale proposal must not write description");
        await assistant.getByTestId("company-description-refresh").click();
        await page.waitForFunction(() => {
          const button = document.querySelector('[data-testid="company-description-save"]');
          return button instanceof HTMLButtonElement && !button.disabled;
        }, null, { timeout: 30000 });
        assert.match(await draft.inputValue(), /Bozza preservata/);
        await assistant.getByTestId("company-description-save").click();
        await state("edited");
        seedResearch(summaryFor(width, "dominio aggiornato"));
        await open();
        await assistant.getByTestId("company-description-edit").click();
        await draft.fill(editedText + " Bozza da recuperare dopo il cambio di sito.");
      }
      fixtureSql(`UPDATE public.network_companies SET website_url='https://new-domain.example.test',website_domain='new-domain.example.test' WHERE id='${companyId}';`);
      if (width === 1440) {
        await assistant.getByTestId("company-description-save").click();
        await assistant.getByTestId("company-description-refresh").waitFor({ state: "visible" });
        await assistant.getByTestId("company-description-refresh").click();
      } else {
        await open();
      }
      await state("source_mismatch");
      if (width === 1440) {
        assert.match(await draft.inputValue(), /Bozza da recuperare/);
        assert.equal(await draft.getAttribute("readonly"), "", "An unavailable proposal preserves a copyable draft");
      }
      await capture("source-mismatch");
      fixtureSql(`UPDATE public.network_companies SET website_url=${sqlString(companyWebsite)},website_domain='company-ux2.example.test' WHERE id='${companyId}';`);
      if (width === 1440) {
        const identical = summaryFor(width, "conferma del testo identico");
        seedResearch(identical);
        fixtureSql(`UPDATE public.network_companies SET description=${sqlString(identical)} WHERE id='${companyId}';`);
        const imported = await admin.rpc("p3_7c_public_company_profile", { p_company_id: companyId });
        assert.ifError(imported.error);
        assert.equal(imported.data.company.description_is_company_declared, false);
        await open();
        await state("already_current");
        await capture("identical-confirmation");
        await assistant.getByTestId("company-description-accept").click();
        await state("accepted");
        assert.equal((await review()).current_description, identical);
        const confirmed = await admin.rpc("p3_7c_public_company_profile", { p_company_id: companyId });
        assert.ifError(confirmed.error);
        assert.equal(confirmed.data.company.description_is_company_declared, true, "Explicit unchanged acceptance records the company declaration");
      }
      const { data: profile, error } = await admin.rpc("p3_7_managed_profile_state", { p_network_company_id: companyId });
      assert.ifError(error);
      assert.equal(profile.company.publication_status, "published");
      assert.equal(profile.company.verification_status, "unverified");
      assert.deepEqual(errors, [], "Uncaught C1 browser errors at " + width);
      assert.deepEqual([...new Set(consoleIssues)], [], "C1 console issues at " + width);
      console.log("COMPANY-UX2.C.1 Chrome PASS", width, "real acceptance/edit/ignore, persisted decision, sources, stale description/proposal, public precedence, domain mismatch and screenshots");
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await admin.auth.signOut();
}
