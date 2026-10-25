/**
 * FLOW1 local acceptance: real search Worker -> calculator -> persisted private
 * bill -> conscious dispatch -> two anonymous supplier offers -> comparison.
 * Run after DEMOTEST2.3 + RFQH14.2 seeds and the FLOW1 structured-search fixture.
 * Start a SEPARATE Next process with product-flow1-local-provider.cjs preloaded.
 * Existing BD15 acceptance must continue to run with RESEND_API_KEY empty.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const origin = process.env.DEMOTEST23_WEB_URL;
assert.equal(origin, "http://127.0.0.1:3000", "External Next URL prohibited");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321", "External Supabase prohibited");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true", "Dedicated local-provider process required");
assert.equal(process.env.RESEND_API_KEY, "flow1-local-synthetic", "Only synthetic local provider allowed");
assert.ok(process.env.WORKER_URL && ["127.0.0.1", "localhost"].includes(new URL(process.env.WORKER_URL).hostname),
  "Real local Worker required; no mocked search response");
assert.ok(process.env.RUNNER_TEMP, "Ephemeral directory required");
const capturePath = path.join(process.env.RUNNER_TEMP, "product-flow1-provider.jsonl");
const personas = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "demotest23-personas.json"), "utf8"));
const buyer = personas.find(p => p.id === "buyer");
const producer = personas.find(p => p.id === "producer");
const trader = personas.find(p => p.id === "trader");
assert.ok(buyer && producer && trader);
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(key, "Local public Supabase key required");
const checks = [];
const executable = process.env.DEMOTEST23_BROWSER_EXECUTABLE;
assert.ok(!executable || executable.startsWith("/"), "Browser executable must be an absolute local path");
const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : { channel: "chrome" }) });

async function step(label, run) {
  try {
    await run();
    checks.push(label);
    console.log("FLOW1 LOCAL PASS", label);
  } catch (error) {
    // Playwright errors can contain bearer links, form values and passwords.
    // Emit only the fixed check label and assertion's own static message.
    const message = error instanceof assert.AssertionError && typeof error.message === "string"
      ? error.message.split("\n")[0] : "Browser/API acceptance failed";
    console.error("FLOW1 LOCAL FAIL", label, message);
    throw new Error("FLOW1 local acceptance failed: " + label);
  }
}
async function visit(page, route) {
  const response = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 90000 });
  assert.ok(response && response.status() < 500, "Local page returned server error");
}
async function context(width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 },
    isMobile: width < 600, deviceScaleFactor: width < 600 ? 2 : 1, locale: "it-IT" });
  await ctx.route("**/*", route => {
    const host = new URL(route.request().url()).hostname;
    return ["127.0.0.1", "localhost", "[::1]"].includes(host) ? route.continue() : route.abort();
  });
  return ctx;
}
async function login(page, person) {
  await visit(page, "/login");
  await page.locator('input[name="email"]').fill(person.email);
  await page.locator('input[name="password"]').fill(person.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/dashboard", { timeout: 90000 });
  await page.getByRole("heading", { name: "Oggi in " + person.name, exact: true }).waitFor({ timeout: 60000 });
  const consent = page.getByTestId("mobile-cookie-consent");
  if (await consent.isVisible()) await consent.getByRole("button", { name: "Accetta necessari" }).click();
}
async function api(person) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error } = await client.auth.signInWithPassword({ email: person.email, password: person.password });
  assert.equal(error, null, "Local GoTrue API sign-in failed");
  return client;
}
async function rows(query) {
  const { data, error } = await query;
  assert.equal(error, null, "Local authenticated data query failed");
  return data;
}
function captured(title) {
  if (!existsSync(capturePath)) return [];
  assert.equal(statSync(capturePath).mode & 0o777, 0o600, "Capability capture must remain private");
  return readFileSync(capturePath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
    .filter(row => row.subject.endsWith(title));
}
async function usable(page) {
  const dimensions = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
  assert.ok(dimensions[1] <= dimensions[0] + 12, "Page must fit the viewport");
  assert.ok(!(await page.locator("body").innerText()).includes("Application error: a server-side exception"),
    "Page must not crash at runtime");
}
async function sourceLines(client, campaign, title) {
  const snapshots = await rows(client.from("buyer_distintas").select("id,line_count,total_meters").eq("title", title));
  assert.equal(snapshots.length, 1, "Exactly one bill snapshot must be persisted");
  assert.equal(snapshots[0].id, campaign.source_distinta_id, "RFQ must reference the created bill");
  assert.equal(snapshots[0].line_count, 2, "Both bill rows must survive persistence");
  assert.equal(Number(snapshots[0].total_meters), 42, "Mixed bar quantities and lengths must survive");
  const lines = await rows(client.from("buyer_distinta_lines").select("*")
    .eq("distinta_id", campaign.source_distinta_id).order("line_position"));
  assert.equal(lines.length, 2, "Persisted bill must have no duplicate rows");
  for (const [index, line] of lines.entries()) {
    assert.equal(line.quantity_mode, "bars", "Quantity unit must survive");
    assert.equal(Number(line.quantity), index === 0 ? 3 : 2, "Bar quantities must survive");
    assert.equal(Number(line.bar_length_m), index === 0 ? 6 : 12, "Bar lengths must survive");
    assert.equal(Number(line.line_meters), index === 0 ? 18 : 24, "Line metres must survive");
    assert.equal(line.standard_code, index === 0 ? "EN 10219" : "EN 10210", "Mixed standards must survive");
    assert.equal(line.grade_code, "S355J2H", "Completed steel grade must survive");
    assert.match(line.description, /60[.,]3/, "Search diameter must reach the saved row");
    assert.match(line.description, /3[.,]2/, "Search thickness must reach the saved row");
    assert.equal(Number(line.target_eur_t), 900, "Private buyer target must survive");
  }
  return lines;
}

try {
  const buyerApi = await api(buyer);
  const producerApi = await api(producer);
  for (const width of [1440, 390]) {
    const title = "FLOW1 E2E LOCAL " + width;
    const message = "FLOW1 contesto consegna verificato " + width;
    const ctx = await context(width);
    const page = await ctx.newPage();
    let campaign, rfqPath, originalLines;
    await step("real buyer login " + width, () => login(page, buyer));
    await step("real Worker search opens calculator with verified geometry " + width, async () => {
      const header = page.locator('form[action="/commercial/search"]');
      await header.locator('input[name="q"]').fill("FLOW1 LOCAL STEEL");
      await header.locator('input[name="q"]').press("Enter");
      await page.waitForURL(url => url.pathname === "/commercial/search" && url.searchParams.get("q") === "FLOW1 LOCAL STEEL",
        { timeout: 60000 });
      const complete = page.getByRole("button", { name: "Completa in calcolatrice →", exact: true });
      await complete.first().waitFor({ state: "visible", timeout: 90000 });
      // One observation may surface as both its RFQ event and a product group.
      // Use the actual product category before handing a selected result over.
      await page.getByRole("navigation", { name: "Categorie ricerca commerciale" })
        .getByRole("link", { name: "Prodotti", exact: true }).click();
      await page.waitForURL(url => url.pathname === "/commercial/search" && url.searchParams.get("scope") === "products",
        { timeout: 60000 });
      await complete.first().waitFor({ state: "visible", timeout: 90000 });
      assert.equal(await complete.count(), 1, "Verified local product group must be unambiguous");
      assert.ok(!(await page.locator("body").innerText()).includes("Worker non configurato"), "Search must execute in Worker");
      await usable(page);
      await complete.click();
      await page.waitForURL(url => url.pathname === "/rfq-hub/distinta", { timeout: 60000 });
      await page.locator('[data-private-calculator-page][data-buyer-draft-ready="true"]').waitFor({ timeout: 60000 });
      await page.locator('#calcolatore-pesi[data-calculator-ready="true"]').waitFor({ timeout: 60000 });
      const calc = page.locator("#calcolatore-pesi");
      assert.equal(await calc.getByRole("combobox", { name: "Norma", exact: true }).inputValue(), "en10219");
      assert.equal(await calc.getByRole("combobox", { name: "Sagoma", exact: true }).inputValue(), "round_tube");
      assert.equal(Number(await calc.getByLabel("Diametro D", { exact: true }).inputValue()), 60.3);
      assert.equal(Number(await calc.getByLabel("Spessore t", { exact: true }).inputValue()), 3.2);
    });
    await step("complete and persist mixed two-line private RFQ " + width, async () => {
      await page.getByLabel("Titolo distinta", { exact: true }).fill(title);
      await page.locator("[data-private-calculator-grade] details > summary").click();
      await page.getByLabel("Grado acciaio · facoltativo ora", { exact: true }).fill("S355J2H");
      const calc = page.locator("#calcolatore-pesi");
      await calc.getByLabel("Lunghezza barra personalizzata", { exact: true }).fill("6");
      await calc.getByLabel("Numero barre", { exact: true }).fill("3");
      await calc.getByRole("button", { name: /Aggiungi alla distinta/ }).click();
      await page.getByTestId("private-cart-trigger").click();
      let bill = page.locator("#buyer-live-preview");
      await bill.locator(".bd10-preview-row:not([hidden])").waitFor({ state: "visible" });
      assert.equal(await bill.locator(".bd10-preview-row:not([hidden])").count(), 1, "First add creates one row");
      await page.getByRole("dialog", { name: "Carrello della distinta privata" }).getByRole("button", { name: /^Chiudi/ }).click();
      await calc.getByRole("combobox", { name: "Norma", exact: true }).selectOption("en10210");
      await calc.getByLabel("Lunghezza barra personalizzata", { exact: true }).fill("12");
      await calc.getByLabel("Numero barre", { exact: true }).fill("2");
      await calc.getByRole("button", { name: /Aggiungi alla distinta/ }).click();
      await page.getByTestId("private-cart-trigger").click();
      bill = page.locator("#buyer-live-preview");
      const lineRows = bill.locator(".bd10-preview-row:not([hidden])");
      await page.waitForFunction(() => document.querySelectorAll("#buyer-live-preview .bd10-preview-row:not([hidden])").length === 2);
      for (let index = 0; index < 2; index += 1) {
        const row = lineRows.nth(index);
        await row.getByRole("button", { name: "Modifica", exact: true }).click();
        const details = row.getByRole("button", { name: "Apri dettagli riga " + (index + 1), exact: true });
        if (await details.count()) await details.click();
        await row.getByLabel("Target €/t (facoltativo)", { exact: true }).fill("900");
      }
      await usable(page);
      const create = bill.getByRole("button", { name: /Crea RFQ privata/ });
      assert.equal(await create.isEnabled(), true, "Both completed lines must be RFQ-ready");
      await create.click();
      await page.waitForURL(url => /^\/rfq-hub\/[0-9a-f-]{36}$/.test(url.pathname), { timeout: 60000 });
      rfqPath = new URL(page.url()).pathname;
      await page.getByRole("heading", { name: title, exact: true }).waitFor({ timeout: 60000 });
      const campaigns = await rows(buyerApi.from("buyer_rfq_campaigns").select("*").eq("title", title));
      assert.equal(campaigns.length, 1, "One action must create exactly one RFQ");
      campaign = campaigns[0];
      assert.equal(rfqPath, "/rfq-hub/" + campaign.id, "Browser must open its persisted RFQ");
      assert.equal(campaign.status, "draft", "New RFQ must remain private and unsent");
      assert.equal(campaign.marketplace_request_id, null, "Private RFQ must not publish Marketplace request");
      originalLines = await sourceLines(buyerApi, campaign, title);
      assert.equal(captured(title).length, 0, "Creating an RFQ must send nothing");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: title, exact: true }).waitFor({ timeout: 60000 });
      await usable(page);
    });
    await step("cancel and explicitly confirm exactly two recipients " + width, async () => {
      await page.getByRole("checkbox", { name: /Seleziona DEMO Steel Manufacturing/ }).check();
      await page.getByRole("checkbox", { name: /Seleziona DEMO Tubes Trading/ }).check();
      await page.getByRole("button", { name: "Aggiungi 2 alla RFQ", exact: true }).click();
      await page.getByText(/2 fornitori aggiunti alla RFQ/).waitFor({ timeout: 60000 });
      await page.getByLabel("Messaggio ai fornitori", { exact: true }).fill(message);
      const reviewButton = page.getByRole("button", { name: /Controlla 2 destinatari/ });
      await reviewButton.click();
      let review = page.getByRole("region", { name: "Conferma finale invio RFQ" });
      await review.waitFor();
      assert.match(await review.innerText(), /rfqh14-producer@example.test/);
      assert.match(await review.innerText(), /rfqh14-trader@example.test/);
      assert.match(await review.innerText(), /Canale effettivo: email individuali/);
      assert.match(await review.innerText(), /Il Marketplace non verrà pubblicato/);
      assert.equal(await review.getByRole("button", { name: /Conferma e invia a 2 fornitori/ }).isEnabled(), false,
        "Sending requires a distinct affirmative recipient confirmation");
      await review.getByRole("checkbox", { name: /Ho verificato destinatari e indirizzi/ }).check();
      await review.getByRole("button", { name: /Annulla, modifica la RFQ/ }).click();
      assert.equal(captured(title).length, 0, "Cancelling verified review must send nothing");
      assert.equal((await rows(buyerApi.from("buyer_rfq_dispatches").select("id").eq("rfq_id", campaign.id))).length, 0,
        "Review must not queue a dispatch");
      await reviewButton.click();
      review = page.getByRole("region", { name: "Conferma finale invio RFQ" });
      const confirm = review.getByRole("button", { name: /Conferma e invia a 2 fornitori/ });
      assert.equal(await confirm.isEnabled(), false, "Reopened review requires fresh confirmation");
      await review.getByRole("checkbox", { name: /Ho verificato destinatari e indirizzi/ }).check();
      assert.equal(await confirm.isEnabled(), true, "Explicitly confirmed recipients enable sending");
      await confirm.evaluate(button => { button.click(); button.click(); });
      await page.getByText(/RFQ avviata: 2 invii effettuati/).waitFor({ timeout: 60000 });
      assert.equal(captured(title).length, 2, "Double activation must deliver one local invite per supplier");
      const dispatches = await rows(buyerApi.from("buyer_rfq_dispatches").select("id,status,provider_message_id,attempt_count")
        .eq("rfq_id", campaign.id));
      assert.equal(dispatches.length, 2, "Dispatch ledger must have no duplicates");
      assert.ok(dispatches.every(row => row.status === "sent" && row.attempt_count === 1 && row.provider_message_id.startsWith("flow1-local-")),
        "Both dispatches must be acknowledged by the local-only provider");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: title, exact: true }).waitFor({ timeout: 60000 });
      assert.equal(captured(title).length, 2, "Reloading sent RFQ must not resend");
      await usable(page);
    });
    for (const [index, person] of [producer, trader].entries()) {
      await step(person.id + " anonymous isolated response and submit " + width, async () => {
        const guest = await context(width);
        try {
          const portal = await guest.newPage();
          const email = index === 0 ? "rfqh14-producer@example.test" : "rfqh14-trader@example.test";
          const invite = captured(title).find(row => row.recipient === email);
          assert.ok(invite, "Supplier must receive its own captured local capability");
          const guestApi = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key,
            { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
          const token = invite.invitePath.split("/").at(-1);
          const payload = await rows(guestApi.rpc("rfqh4_get_portal", {
            p_token_hash: createHash("sha256").update(token).digest("hex"),
          }));
          assert.equal(payload.valid, true, "Real anonymous capability must resolve");
          assert.equal(payload.quote, null, "Fresh supplier capability must not expose another supplier quote");
          assert.doesNotMatch(JSON.stringify(payload), /target_eur_t|target_eur_m|target_total_eur|token_hash|idempotency_key/,
            "Private fields must be absent from the actual supplier API payload");
          assert.equal(payload.lines.length, 2, "Supplier API must retain both requested lines");
          for (const [lineIndex, line] of payload.lines.entries()) {
            assert.equal(line.line_id, originalLines[lineIndex].id, "Supplier API must preserve source-line identity");
            assert.equal(Number(line.quantity), lineIndex === 0 ? 3 : 2, "Supplier API must preserve requested quantities");
            assert.equal(Number(line.bar_length_m), lineIndex === 0 ? 6 : 12, "Supplier API must preserve bar lengths");
          }
          await visit(portal, invite.invitePath);
          await portal.getByRole("heading", { name: title, exact: true }).waitFor({ timeout: 60000 });
          const body = await portal.locator("body").innerText();
          assert.match(body, /EN 10219/);
          assert.match(body, /EN 10210/);
          assert.match(body, /S355J2H/);
          assert.ok(body.includes(message), "Buyer delivery context must reach the invited supplier");
          assert.ok(!body.includes(index === 0 ? trader.name : producer.name), "Competing supplier identity must remain private");
          assert.ok(!/\b900\b/.test(body), "Private buyer target must not reach supplier");
          if (index === 1) assert.ok(!/\b735\b|\b755\b/.test(body), "Competing supplier prices must remain private");
          const prices = portal.locator('input[placeholder="es. 760"]');
          assert.equal(await prices.count(), 2, "Supplier must receive both original lines");
          await prices.nth(0).fill(index === 0 ? "735" : "760");
          await prices.nth(1).fill(index === 0 ? "755" : "780");
          await portal.getByRole("button", { name: "Salva bozza", exact: true }).click();
          await portal.getByText("Bozza salvata.", { exact: true }).waitFor({ timeout: 45000 });
          await portal.getByRole("button", { name: "Invia offerta", exact: true }).click();
          await portal.getByText(/Offerta inviata al buyer|submitted/i).first().waitFor({ timeout: 45000 });
          await usable(portal);
        } finally { await guest.close(); }
      });
    }
    await step("buyer compares complete offers without losing request context " + width, async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Confronto offerte", exact: true }).waitFor({ timeout: 60000 });
      const body = await page.locator("body").innerText();
      assert.ok(body.includes(producer.name) && body.includes(trader.name), "Both suppliers must appear in comparison");
      assert.ok(body.includes("735") && body.includes("780"), "Both submitted supplier prices must appear");
      const comparison = await rows(buyerApi.rpc("rfqh5_quote_comparison", { p_rfq_id: campaign.id }));
      assert.equal(comparison.summary.complete_offer_count, 2, "Both quotes must cover the full bill");
      assert.equal(comparison.summary.comparable_supplier_count, 2, "Both quotes must be comparable");
      assert.equal(comparison.lines.length, 2, "Comparison must retain both source lines");
      for (const [index, line] of comparison.lines.entries()) {
        assert.equal(line.line_id, originalLines[index].id, "Comparison must preserve source-line identity");
        assert.equal(Number(line.quantity), index === 0 ? 3 : 2, "Comparison must preserve quantities");
        assert.equal(line.quotes.length, 2, "Each supplier must quote each line exactly once");
        assert.ok(line.quotes.every(quote => quote.is_full_line_coverage && Number(quote.quantity_coverage_pct) === 100),
          "Supplier response quantities must cover 100% of requested quantities");
      }
      assert.deepEqual(await sourceLines(buyerApi, campaign, title), originalLines, "Responses must not mutate immutable bill rows");
      assert.equal(captured(title).length, 2, "Supplier submissions must not emit additional invitations");
      await usable(page);
    });
    await step("supplier tenant cannot read buyer private request " + width, async () => {
      for (const [table, column, id] of [["buyer_rfq_campaigns", "id", campaign.id],
        ["buyer_distintas", "id", campaign.source_distinta_id], ["buyer_distinta_lines", "distinta_id", campaign.source_distinta_id],
        ["buyer_rfq_dispatches", "rfq_id", campaign.id]]) {
        assert.equal((await rows(producerApi.from(table).select("id").eq(column, id))).length, 0,
          "Other tenant must not read private procurement rows");
      }
      const other = await context(width);
      try {
        const otherPage = await other.newPage();
        await login(otherPage, producer);
        await visit(otherPage, rfqPath);
        await otherPage.waitForFunction(expected => /404|non trovata|not found|could not be found/i.test(document.body.innerText)
          || document.body.innerText.includes(expected), title, { timeout: 60000 });
        assert.ok(!(await otherPage.locator("body").innerText()).includes(title), "Other tenant route must not expose buyer RFQ");
      } finally { await other.close(); }
    });
    await ctx.close();
  }
  await buyerApi.auth.signOut();
  await producerApi.auth.signOut();
  console.log("FLOW1 LOCAL ACCEPTANCE PASS", checks.length,
    "checks; 1440/390; real Worker/GoTrue/DB; 4 captured local invites; no external mail");
} finally { await browser.close(); }
