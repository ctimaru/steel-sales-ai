/** C.2 acceptance: actual owner decisions and concurrent RPCs on disposable localhost data. */
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
const groups = { product: "products", capability: "capabilities", market: "markets", certification: "certifications" };
const panels = { product: "products", capability: "facilities", market: "markets", certification: "certifications" };
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
async function signed(person) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, clientOptions);
  const { error } = await client.auth.signInWithPassword({ email: person.email, password: person.password });
  assert.ifError(error);
  return client;
}
const admin = await signed(owner);
const otherSession = await signed(owner);
const args = { p_organization_id: owner.org, p_network_company_id: companyId };
async function review() {
  const { data, error } = await admin.rpc("company_ux2c2_industrial_review", args);
  assert.ifError(error);
  assert.equal(data?.contract, "company-ux2c2-industrial-v1");
  return data;
}
async function managed() {
  const { data, error } = await admin.rpc("p3_7_managed_profile_state", { p_network_company_id: companyId });
  assert.ifError(error);
  return data;
}
function proposal(data, kind, label) {
  const result = data.proposals.find(item => item.kind === kind && item.label === label);
  assert.ok(result, "Missing C2 fixture proposal: " + kind + " / " + label);
  return result;
}
function decisionArgs(data, kind, label, selection, action = "confirm") {
  return {
    ...args, p_expected_proposal_hash: proposal(data, kind, label).proposal_hash,
    p_expected_state_hash: data.state_hashes[groups[kind]], p_action: action, p_selection: selection,
  };
}
const sqlString = value => "'" + String(value).replaceAll("'", "''") + "'";
const sqlArray = values => "ARRAY[" + values.map(sqlString).join(",") + "]::text[]";
const psqlArgs = ["--host", "127.0.0.1", "--port", "54322", "--username", "postgres", "--dbname", "postgres", "--set", "ON_ERROR_STOP=1", "--no-psqlrc", "--quiet", "--tuples-only", "--no-align"];
function localSql(statement) {
  return execFileSync("psql", psqlArgs, {
    input: statement, env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}
function fixtureSql(statement) { localSql("BEGIN;\n" + statement + "\nCOMMIT;\n"); }
function sqlJson(expression) { return JSON.parse(localSql("SELECT " + expression + ";\n")); }
function seedResearch({ products = [], activities = [], sectors = [], certifications = [], version = "c2-local-fixture-v1" } = {}) {
  fixtureSql("INSERT INTO private.network_company_research " +
    "(company_id,status,summary,products,activities,sectors,certifications,markets,source_urls,extractor_version,model,researched_at,published_at) VALUES (" +
    sqlString(companyId) + ",'published'," +
    sqlString("DEMO ricerca aziendale sintetica per la revisione esplicita di prodotti, lavorazioni, settori e certificazioni; nessun dato reale.") + "," +
    [products, activities, sectors, certifications, ["Germania"], sources].map(sqlArray).join(",") + "," +
    sqlString(version) + ",'synthetic-test-only',now(),'2026-11-27T09:00:00Z')" +
    " ON CONFLICT(company_id) DO UPDATE SET status=excluded.status,summary=excluded.summary," +
    "products=excluded.products,activities=excluded.activities,sectors=excluded.sectors,certifications=excluded.certifications," +
    "markets=excluded.markets,source_urls=excluded.source_urls,extractor_version=excluded.extractor_version,model=excluded.model," +
    "researched_at=excluded.researched_at,published_at=excluded.published_at,last_error=null;");
}
function counts() {
  return sqlJson("jsonb_build_object(" +
    "'products',(SELECT count(*) FROM public.network_company_products WHERE company_id=" + sqlString(companyId) + ")," +
    "'capabilities',(SELECT count(*) FROM public.network_facility_capabilities c JOIN public.network_facilities f ON f.id=c.facility_id WHERE f.company_id=" + sqlString(companyId) + ")," +
    "'markets',(SELECT count(*) FROM public.network_company_markets WHERE company_id=" + sqlString(companyId) + ")," +
    "'certifications',(SELECT count(*) FROM public.network_company_certifications WHERE company_id=" + sqlString(companyId) + ")," +
    "'events',(SELECT count(*) FROM public.network_profile_management_events WHERE network_company_id=" + sqlString(companyId) + ")," +
    "'assertions',(SELECT count(*) FROM public.network_data_assertions WHERE asserted_by=" + sqlString(owner.userId) + ")," +
    "'decisions',(SELECT count(*) FROM private.company_ux2c2_industrial_decisions WHERE network_company_id=" + sqlString(companyId) + "))");
}
async function createFacility(name) {
  const { data, error } = await admin.rpc("p3_7b_upsert_facility", {
    p_network_company_id: companyId, p_facility_id: null,
    p_payload: { name, facility_type: "plant", country_code: "IT", publication_status: "published" },
  });
  assert.ifError(error);
  assert.ok(data?.facility_id);
  return data.facility_id;
}
async function manualProduct(key, relationship, facilityId) {
  return otherSession.rpc("p3_7b_set_product", {
    p_network_company_id: companyId, p_product_key: key, p_relationship_type: relationship,
    p_facility_id: facilityId, p_enabled: true,
  });
}
const viewerClient = await signed(viewer);
for (const [rpc, parameters] of [
  ["company_ux2c2_industrial_review", args],
  ["company_ux2c2_decide_industrial", { ...args, p_expected_proposal_hash: "a".repeat(64), p_expected_state_hash: "b".repeat(64), p_action: "ignore", p_selection: null }],
]) {
  const { error } = await viewerClient.rpc(rpc, parameters);
  assert.equal(error?.code, "42501", "Viewer denied by " + rpc);
}
await viewerClient.auth.signOut();
const initialCompany = (await managed()).company;
assert.equal(initialCompany.website_url, companyWebsite, "C1 fixture must finish on its original official website");

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const facilityId = await createFacility("DEMO C2 plant " + width);
    const initial = await managed();
    const market = initial.taxonomy.markets.find(item => !initial.markets.some(existing => existing.key === item.key));
    assert.ok(market, "An unused canonical sector is required for independent C2 acceptance");
    const marketKey = market.key;
    const labels = {
      product: width === 1440 ? "Tubi saldati" : "Tubi saldati DEMO " + width,
      capability: width === 1440 ? "Taglio laser" : "Taglio laser DEMO " + width,
      market: market.name + " DEMO " + width,
      certification: width === 1440 ? "ISO 9001" : "Certificazione ISO 9001 DEMO " + width,
      ignored: "Non produciamo tubi saldati DEMO " + width,
      withdrawn: "Fornitura da rivedere DEMO " + width,
      duplicate: "Settore già presente DEMO " + width,
    };
    seedResearch();
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
      const assistant = kind => page.locator('[data-testid="company-industrial-assistant"][data-kind="' + kind + '"]');
      async function open(kind) {
        const response = await page.goto(base + "/company/profile#" + panels[kind], { waitUntil: "domcontentloaded", timeout: 90000 });
        if (!response) await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
        await assistant(kind).waitFor({ state: "visible", timeout: 30000 });
      }
      async function card(kind, label) {
        const item = proposal(await review(), kind, label);
        const locator = assistant(kind).locator('[data-testid="company-industrial-proposal"][data-content-key="' + item.content_key + '"]');
        await locator.waitFor({ state: "visible" });
        return locator;
      }
      async function state(locator, expected) {
        const contentKey = await locator.getAttribute("data-content-key");
        try {
          await page.waitForFunction(({ contentKey, expected }) =>
            document.querySelector('[data-testid="company-industrial-proposal"][data-content-key="' + contentKey + '"]')?.getAttribute("data-state") === expected,
          { contentKey, expected }, { timeout: 30000 });
        } catch (error) {
          console.error("C2 state failure", { width, expected, actual: await locator.getAttribute("data-state"), text: (await locator.innerText()).slice(0, 1600), errors, consoleIssues });
          await page.screenshot({ path: path.join(output, "company-ux2c2-failed-" + expected + "-" + width + ".png"), fullPage: true, animations: "disabled", caret: "initial" });
          throw error;
        }
      }
      async function capture(target, name, full = false) {
        const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(metrics.scroll <= metrics.width + 2, "C2 overflow " + name + " at " + width + ": " + JSON.stringify(metrics));
        const stem = path.join(output, "company-ux2c2-" + name);
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
      async function begin(locator, key, kind) {
        await locator.getByTestId("company-industrial-review").click();
        await locator.getByTestId("company-industrial-form").waitFor({ state: "visible" });
        if (kind === "product") assert.equal(await locator.getByTestId("company-industrial-relationship").inputValue(), "", "No implied product relationship");
        if (kind !== "market") assert.equal(await locator.getByTestId("company-industrial-facility").inputValue(), "", "Scope requires an explicit choice");
        await locator.getByTestId("company-industrial-key").selectOption(key);
      }
      async function confirmed(locator, kind, label) {
        await locator.getByTestId("company-industrial-confirm").click();
        await state(locator, "confirmed");
        const saved = proposal(await review(), kind, label).decision;
        assert.equal(saved?.action, "confirmed");
        assert.equal(saved?.effect, "added");
        assert.ok(saved?.target_id);
        return saved.target_id;
      }

      await open("product");
      await assistant("product").getByTestId("company-industrial-empty").waitFor({ state: "visible" });
      await capture(assistant("product"), "empty");
      seedResearch({ products: [labels.product, labels.ignored, labels.withdrawn], activities: [labels.capability], sectors: [labels.market, labels.duplicate], certifications: [labels.certification] });
      const beforeRead = counts();
      await open("product");
      let productCard = await card("product", labels.product);
      assert.deepEqual(counts(), beforeRead, "Rendering industrial suggestions must not write canonical data or decisions");
      const research = await review();
      assert.equal(proposal(research, "product", labels.ignored).suggested_key, null);
      assert.equal(research.proposals.some(item => item.label === "Germania"), false);
      await begin(productCard, "tubes_pipes", "product");
      assert.equal(await productCard.getByTestId("company-industrial-confirm").isDisabled(), true);
      await productCard.getByTestId("company-industrial-relationship").selectOption("stocks");
      await productCard.getByTestId("company-industrial-facility").selectOption(facilityId);
      const evidence = productCard.getByTestId("company-industrial-sources");
      await evidence.locator("summary").click();
      assert.deepEqual(await evidence.locator("a").evaluateAll(nodes => nodes.map(node => node.href)), sources);
      assert.match(await evidence.innerText(), /ricerca aziendale/);
      await capture(productCard, "products-review", true);

      const manual = await manualProduct("plates", "stocks", facilityId);
      assert.ifError(manual.error);
      await productCard.getByTestId("company-industrial-confirm").click();
      await state(productCard, "stale");
      assert.equal(await productCard.getByTestId("company-industrial-confirm").isDisabled(), true);
      assert.equal(await productCard.getByTestId("company-industrial-key").inputValue(), "tubes_pipes");
      assert.equal(await productCard.getByTestId("company-industrial-relationship").inputValue(), "stocks");
      assert.equal(await productCard.getByTestId("company-industrial-facility").inputValue(), facilityId);
      await capture(productCard, "products-stale");
      await capture(productCard.getByTestId("company-industrial-feedback"), "products-stale-feedback");
      await productCard.getByTestId("company-industrial-refresh").click();
      await page.waitForFunction(key => {
        const button = document.querySelector('[data-content-key="' + key + '"] [data-testid="company-industrial-confirm"]');
        return button instanceof HTMLButtonElement && !button.disabled;
      }, await productCard.getAttribute("data-content-key"), { timeout: 30000 });
      assert.equal(await productCard.getByTestId("company-industrial-relationship").inputValue(), "stocks");
      assert.equal(await productCard.getByTestId("company-industrial-facility").inputValue(), facilityId);
      const productId = await confirmed(productCard, "product", labels.product);
      const storedProduct = (await managed()).products.find(item => item.id === productId);
      assert.equal(storedProduct?.key, "tubes_pipes");
      assert.equal(storedProduct?.relationship_type, "stocks");
      assert.equal(storedProduct?.facility_id, facilityId);
      await capture(productCard, "products-confirmed");
      await open("product");
      productCard = await card("product", labels.product);
      await state(productCard, "confirmed");
      assert.equal(await productCard.getByTestId("company-industrial-confirm").count(), 0);

      const ignoredCard = await card("product", labels.ignored);
      await ignoredCard.getByTestId("company-industrial-review").click();
      assert.equal(await ignoredCard.getByTestId("company-industrial-key").inputValue(), "");
      const beforeIgnore = counts();
      await ignoredCard.getByTestId("company-industrial-ignore").click();
      await state(ignoredCard, "ignored");
      const afterIgnore = counts();
      assert.deepEqual({ ...afterIgnore, decisions: beforeIgnore.decisions }, beforeIgnore);
      assert.equal(afterIgnore.decisions, beforeIgnore.decisions + 1);
      fixtureSql("UPDATE private.network_company_research SET researched_at=now()+interval '1 day',last_error='synthetic failed refresh' WHERE company_id=" + sqlString(companyId) + ";");
      await open("product");
      await state(await card("product", labels.ignored), "ignored");
      await capture(await card("product", labels.ignored), "ignored");

      const withdrawnCard = await card("product", labels.withdrawn);
      await begin(withdrawnCard, "bars", "product");
      await withdrawnCard.getByTestId("company-industrial-relationship").selectOption("uses");
      await withdrawnCard.getByTestId("company-industrial-facility").selectOption(facilityId);
      const beforeWithdrawal = counts();
      fixtureSql("UPDATE private.network_company_research SET products=array_remove(products," + sqlString(labels.withdrawn) + ") WHERE company_id=" + sqlString(companyId) + ";");
      await withdrawnCard.getByTestId("company-industrial-confirm").click();
      await state(withdrawnCard, "stale");
      await withdrawnCard.getByTestId("company-industrial-refresh").click();
      await state(withdrawnCard, "unavailable");
      for (const [testId, expected] of [
        ["company-industrial-key", "bars"],
        ["company-industrial-relationship", "uses"],
        ["company-industrial-facility", facilityId],
      ]) {
        assert.equal(await withdrawnCard.getByTestId(testId).inputValue(), expected, "Unavailable proposal retains the human draft");
        assert.equal(await withdrawnCard.getByTestId(testId).isDisabled(), true);
      }
      assert.equal(await withdrawnCard.getByTestId("company-industrial-confirm").count(), 0);
      assert.deepEqual(counts(), beforeWithdrawal, "A withdrawn proposal cannot create a target or decision");
      await capture(withdrawnCard, "unavailable-draft");

      await open("capability");
      const capabilityCard = await card("capability", labels.capability);
      await begin(capabilityCard, "laser_cutting", "capability");
      assert.equal(await capabilityCard.getByTestId("company-industrial-confirm").isDisabled(), true);
      await capabilityCard.getByTestId("company-industrial-facility").selectOption(facilityId);
      await capture(capabilityCard, "capabilities-review", true);
      const capabilityId = await confirmed(capabilityCard, "capability", labels.capability);
      const storedFacility = (await managed()).facilities.find(item => item.id === facilityId);
      assert.ok(storedFacility?.capabilities.some(item => item.id === capabilityId && item.key === "laser_cutting" && item.verification_status === "unverified"));
      await page.waitForFunction(({ contentKey, facilityId }) =>
        document.querySelector('[data-content-key="' + contentKey + '"] [data-testid="company-industrial-existing"]')?.getAttribute("href") === "#facilities-item-" + facilityId,
      { contentKey: await capabilityCard.getAttribute("data-content-key"), facilityId }, { timeout: 30000 });
      assert.equal(await capabilityCard.getByTestId("company-industrial-existing").getAttribute("href"), "#facilities-item-" + facilityId);

      await open("market");
      const marketCard = await card("market", labels.market);
      await begin(marketCard, marketKey, "market");
      await capture(marketCard, "markets-review", true);
      const marketId = await confirmed(marketCard, "market", labels.market);
      assert.ok((await managed()).markets.some(item => item.id === marketId && item.key === marketKey));
      const duplicate = await card("market", labels.duplicate);
      const beforeDuplicate = counts();
      await begin(duplicate, marketKey, "market");
      await state(duplicate, "already_present");
      assert.equal(await duplicate.getByTestId("company-industrial-confirm").count(), 0);
      await duplicate.getByTestId("company-industrial-existing").waitFor({ state: "visible" });
      assert.deepEqual(counts(), beforeDuplicate, "A duplicate selection must remain read-only");
      await capture(duplicate, "markets-existing");

      await open("certification");
      const certificationCard = await card("certification", labels.certification);
      await begin(certificationCard, "iso_9001", "certification");
      assert.equal(await certificationCard.getByTestId("company-industrial-confirm").isDisabled(), true);
      await certificationCard.getByTestId("company-industrial-facility").selectOption(facilityId);
      assert.equal(await certificationCard.locator('input[name="issuer"],input[name="valid_from"],input[name="valid_to"],input[name="certificate_identifier"]').count(), 0);
      await capture(certificationCard, "certifications-review", true);
      const certificationId = await confirmed(certificationCard, "certification", labels.certification);
      const certification = sqlJson("(SELECT to_jsonb(c) FROM public.network_company_certifications c WHERE id=" + sqlString(certificationId) + ")");
      assert.equal(certification.facility_id, facilityId);
      assert.equal(certification.verification_status, "unverified");
      for (const key of ["issuer", "certificate_identifier", "valid_from", "valid_to", "scope_text", "evidence_reference"]) assert.equal(certification[key], null, "No invented certificate " + key);
      await capture(certificationCard, "certifications-confirmed");
      await open("certification");
      await state(await card("certification", labels.certification), "confirmed");
      const finalCompany = (await managed()).company;
      for (const key of ["description", "publication_status", "verification_status", "claimed_status"]) assert.equal(finalCompany[key], initialCompany[key], "C2 must preserve company " + key);
      assert.deepEqual(errors, [], "Uncaught C2 browser errors at " + width);
      assert.deepEqual([...new Set(consoleIssues)], [], "C2 console issues at " + width);
      console.log("COMPANY-UX2.C.2 Chrome PASS", width, "four canonical additions, explicit choices, stale recovery, preserved unavailable draft, read-only duplicate, ignored persistence and screenshots");
    } catch (error) {
      if (page && !page.isClosed()) {
        try {
          const cards = await page.getByTestId("company-industrial-proposal").evaluateAll(elements => elements
            .filter(element => element.getClientRects().length > 0)
            .slice(0, 12)
            .map(element => ({
              kind: element.getAttribute("data-kind")?.slice(0, 24),
              contentKey: element.getAttribute("data-content-key")?.slice(0, 64),
              state: element.getAttribute("data-state")?.slice(0, 32),
              label: element.querySelector('[data-testid="company-industrial-label"]')?.textContent?.slice(0, 160),
              fields: Array.from(element.querySelectorAll("select")).slice(0, 4).map(field => ({
                name: field.name.slice(0, 40), value: field.value.slice(0, 160), disabled: field.matches(":disabled"),
              })),
              feedback: element.querySelector('[data-testid="company-industrial-feedback"]')?.textContent?.slice(0, 800),
            })));
          console.error("C2 case failure", JSON.stringify({ width, cards,
            errors: errors.slice(-8).map(value => value.slice(0, 1200)),
            consoleIssues: consoleIssues.slice(-8).map(value => value.slice(0, 1200)),
          }));
        } catch (diagnosticError) {
          console.error("C2 case diagnostics unavailable", String(diagnosticError).slice(0, 400));
        }
        try {
          await page.screenshot({ path: path.join(output, "company-ux2c2-failed-case-" + width + ".png"), animations: "disabled", caret: "initial", timeout: 10000 });
        } catch (diagnosticError) {
          console.error("C2 failure screenshot unavailable", String(diagnosticError).slice(0, 400));
        }
      }
      throw error;
    } finally {
      await context.close();
    }
  }

  // Actual simultaneous HTTP/RPC requests against committed local fixtures.
  // The final canonical rows and audit are the oracle, not only HTTP outcomes.
  const raceFacility = await createFacility("DEMO C2 concurrent plant");
  seedResearch({ products: ["Fornitura DEMO concorrenza C2"] });
  const concurrentReview = await review();
  const sameRequest = decisionArgs(concurrentReview, "product", "Fornitura DEMO concorrenza C2", {
    key: "tubes_pipes", relationship_type: "stocks", facility_id: raceFacility,
  });
  const beforeRace = counts();
  const simultaneous = await Promise.all([
    admin.rpc("company_ux2c2_decide_industrial", sameRequest),
    otherSession.rpc("company_ux2c2_decide_industrial", sameRequest),
  ]);
  for (let i = 0; i < simultaneous.length; i++) {
    if (simultaneous[i].error?.code === "40001") simultaneous[i] = await admin.rpc("company_ux2c2_decide_industrial", sameRequest);
    assert.ifError(simultaneous[i].error);
  }
  assert.equal(simultaneous[0].data.decision_id, simultaneous[1].data.decision_id);
  assert.equal(simultaneous[0].data.target_id, simultaneous[1].data.target_id);
  assert.equal(simultaneous.filter(item => item.data.changed).length, 1);
  const afterRace = counts();
  for (const key of ["products", "events", "assertions", "decisions"]) assert.equal(afterRace[key], beforeRace[key] + 1, "Concurrent same-choice delta: " + key);

  seedResearch({ products: ["Fornitura DEMO concorrenza manuale"] });
  const manualRaceReview = await review();
  const selection = { key: "plates", relationship_type: "distributes", facility_id: raceFacility };
  const beforeManualRace = counts();
  let [assistedRace, legacyRace] = await Promise.all([
    admin.rpc("company_ux2c2_decide_industrial", decisionArgs(manualRaceReview, "product", "Fornitura DEMO concorrenza manuale", selection)),
    manualProduct("plates", "distributes", raceFacility),
  ]);
  if (legacyRace.error) assert.ok(["23505", "40001", "40P01"].includes(legacyRace.error.code), "Legacy race may conflict, not silently overwrite");
  if (assistedRace.error) {
    assert.equal(assistedRace.error.code, "40001", "C2 must translate a concurrent insertion into a recoverable conflict");
    assistedRace = await admin.rpc("company_ux2c2_decide_industrial",
      decisionArgs(await review(), "product", "Fornitura DEMO concorrenza manuale", selection));
  }
  assert.ifError(assistedRace.error);
  const afterManualRace = counts();
  for (const key of ["products", "events", "assertions", "decisions"]) assert.equal(afterManualRace[key], beforeManualRace[key] + 1, "Manual/assisted race must have no duplicate or orphan: " + key);
  const final = await managed();
  assert.equal(final.products.filter(item => item.key === "plates" && item.relationship_type === "distributes" && item.facility_id === raceFacility).length, 1);
  console.log("COMPANY-UX2.C.2 concurrent C2/C2 and C2/manual product RPC PASS: one target, one assertion/event, one decision; no orphan write");
} finally {
  await browser.close();
  await admin.auth.signOut();
  await otherSession.auth.signOut();
}
