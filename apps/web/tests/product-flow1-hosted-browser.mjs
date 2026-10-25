/**
 * Hosted partial acceptance: exact isolated preview -> real server action ->
 * staging Worker -> staging data. Existing QA identities only; no supplier send.
 * Full dispatch/response/comparison acceptance belongs to the disposable CI run.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { hostedConfig, openHostedSession } from "./product-flow1-hosted-session.mjs";

const query = "FLOW1 HOSTED STEEL";
const filenames = { A: "flow1-hosted-a.eml", B: "flow1-hosted-b.eml" };
let currentCheck = "hosted configuration";
let completed = 0;

async function step(label, run) {
  currentCheck = label;
  await run();
  completed += 1;
  console.log("FLOW1 HOSTED PASS", label);
}

async function rows(request) {
  const { data, error } = await request;
  assert.equal(error, null, "Authenticated staging data read must succeed");
  assert.ok(Array.isArray(data), "Authenticated staging read must return rows");
  return data;
}

async function usable(page) {
  const ok = await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 12 &&
    !document.body.innerText.includes("Application error: a server-side exception"));
  assert.equal(ok, true, "Hosted page must fit its viewport and remain available");
}

async function contextFor(browser, config, session, width) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    isMobile: width === 390, locale: "it-IT", reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.route("**/*", route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const headers = { ...request.headers() };
    delete headers["x-vercel-protection-bypass"];
    if (url.origin === config.previewUrl) {
      const safeActionPath = url.pathname === "/commercial/search" || url.pathname === "/rfq-hub/distinta";
      const allowed = ["GET", "HEAD"].includes(method) ||
        (method === "POST" && safeActionPath && Boolean(headers["next-action"]));
      if (!allowed) return route.abort();
      if (config.bypassSecret) headers["x-vercel-protection-bypass"] = config.bypassSecret;
      return route.continue({ headers });
    }
    // Browser session verification may fetch the staging public JWKS. It must
    // never become a browser-side Data API or direct Worker test shortcut.
    if (url.origin === config.supabaseUrl && ["GET", "HEAD"].includes(method) &&
        url.pathname.startsWith("/auth/v1/")) return route.continue({ headers });
    return route.abort();
  });
  await session.addCookies(context);
  return context;
}

async function visit(page, config, route) {
  const response = await page.goto(config.previewUrl + route, { waitUntil: "domcontentloaded", timeout: 90000 });
  assert.ok(response && response.status() < 500, "Hosted page must respond without a server failure");
  assert.equal(new URL(page.url()).origin, config.previewUrl, "Navigation must remain on the isolated preview");
  return response;
}

function searchResponse(page, config) {
  return page.waitForResponse(response => {
    const request = response.request();
    const url = new URL(response.url());
    const body = request.postData() ?? "";
    const submittedQuery = body.includes(query) || body.includes(encodeURIComponent(query)) ||
      body.includes(query.replaceAll(" ", "+"));
    return url.origin === config.previewUrl && url.pathname === "/commercial/search" &&
      request.method() === "POST" && Boolean(request.headers()["next-action"]) && submittedQuery;
  }, { timeout: 90000 }).catch(() => null);
}

async function verifySearchAction(response, own, foreign, allTypes) {
  assert.ok(response, "Real Next search action response must be observed");
  assert.equal(response.status(), 200, "Real Next server action must return HTTP 200");
  assert.match(response.headers()["content-type"] ?? "", /text\/x-component/,
    "Search must return the real server action Flight response");
  // Flight remains in memory. Nothing from its content is logged or saved.
  const flight = await response.text();
  assert.match(flight, /"status"\s*:\s*"success"/, "Real Worker search must succeed");
  assert.match(flight, /"model"\s*:\s*null/, "Hosted search must run without an embedding model");
  assert.ok(flight.includes(query) && flight.includes(own), "Action response must contain the authorized synthetic source");
  assert.ok(!flight.includes(foreign), "Action response must exclude the foreign synthetic source");
  if (allTypes) assert.match(flight, /"filters"\s*:\s*\{\s*\}/, "Unfiltered search must not depend on a technical filter");
}

async function searchToCalculator(page, config, label) {
  const own = filenames[label];
  const foreign = filenames[label === "A" ? "B" : "A"];
  const pending = searchResponse(page, config);
  await visit(page, config, "/commercial/search?q=" + encodeURIComponent(query));
  assert.equal(new URL(page.url()).pathname, "/commercial/search", "Existing QA session must reach private search");
  await verifySearchAction(await pending, own, foreign, true);
  const consent = page.getByTestId("mobile-cookie-consent");
  if (await consent.isVisible()) {
    await consent.getByRole("button", { name: "Accetta necessari" }).click();
    await consent.waitFor({ state: "hidden" });
  }
  const search = page.getByLabel("Global Search", { exact: true });
  await search.waitFor({ state: "visible", timeout: 60000 });
  assert.equal(await page.locator('input[name="types"]:checked').count(), 0,
    "Unfiltered search must include all result families");
  for (const name of ["company", "grade", "standard", "product_family", "outer_diameter_mm", "thickness_mm",
    "width_mm", "height_mm", "length_mm", "price_min", "price_max", "currency", "source", "source_type",
    "document_type", "date_from", "date_to", "item_role"]) {
    assert.equal(await page.locator('[name="' + name + '"]').inputValue(), "", "Technical filters must remain empty");
  }
  await page.getByText("Fonte: " + own, { exact: true }).first().waitFor({ state: "visible", timeout: 60000 });
  assert.equal(await page.getByText("Fonte: " + foreign, { exact: true }).count(), 0,
    "Search UI must exclude the foreign source");
  await usable(page);
  const productResponse = searchResponse(page, config);
  await page.getByRole("navigation", { name: "Categorie ricerca commerciale" })
    .getByRole("link", { name: "Prodotti", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/commercial/search" && url.searchParams.get("scope") === "products",
    { timeout: 60000 });
  await verifySearchAction(await productResponse, own, foreign, false);
  const complete = page.getByRole("button", { name: "Completa in calcolatrice →", exact: true });
  await complete.first().waitFor({ state: "visible", timeout: 60000 });
  assert.equal(await complete.count(), 1, "Synthetic product group must be unambiguous");
  await complete.click();
  await page.waitForURL(url => url.pathname === "/rfq-hub/distinta", { timeout: 60000 });
  await page.locator('[data-private-calculator-page][data-buyer-draft-ready="true"]').waitFor({ timeout: 60000 });
  const calculator = page.locator('#calcolatore-pesi[data-calculator-ready="true"]');
  await calculator.waitFor({ timeout: 60000 });
  assert.equal(await calculator.getByRole("combobox", { name: "Norma", exact: true }).inputValue(), "en10219");
  assert.equal(await calculator.getByRole("combobox", { name: "Sagoma", exact: true }).inputValue(), "round_tube");
  assert.equal(Number((await calculator.getByLabel("Diametro D", { exact: true }).inputValue()).replace(",", ".")), 60.3);
  assert.equal(Number((await calculator.getByLabel("Spessore t", { exact: true }).inputValue()).replace(",", ".")), 3.2);
  await usable(page);
}

async function verifySnapshot(api, campaign, title) {
  const snapshots = await rows(api.from("buyer_distintas").select("id,line_count,total_meters").eq("title", title));
  assert.equal(snapshots.length, 1, "Exactly one snapshot must exist");
  assert.equal(snapshots[0].id, campaign.source_distinta_id, "RFQ must retain its source snapshot");
  assert.equal(snapshots[0].line_count, 2, "Snapshot must retain both rows");
  assert.equal(Number(snapshots[0].total_meters), 42, "Snapshot must retain 42 metres");
  const lines = await rows(api.from("buyer_distinta_lines")
    .select("id,description,line_position,quantity_mode,quantity,bar_length_m,line_meters,standard_code,grade_code")
    .eq("distinta_id", campaign.source_distinta_id).order("line_position"));
  assert.equal(lines.length, 2, "Snapshot must contain no missing or duplicate rows");
  for (const [index, line] of lines.entries()) {
    assert.equal(line.line_position, index + 1);
    assert.equal(line.quantity_mode, "bars");
    assert.equal(Number(line.quantity), index === 0 ? 3 : 2);
    assert.equal(Number(line.bar_length_m), index === 0 ? 6 : 12);
    assert.equal(Number(line.line_meters), index === 0 ? 18 : 24);
    assert.equal(line.standard_code, index === 0 ? "EN 10219" : "EN 10210");
    assert.equal(line.grade_code, "S355J2H");
    assert.match(line.description, /60[.,]3/, "Verified diameter must survive persistence");
    assert.match(line.description, /3[.,]2/, "Verified thickness must survive persistence");
  }
  return lines;
}

async function createPrivateDraft(page, session, title) {
  assert.equal((await rows(session.api.from("buyer_rfq_campaigns").select("id").eq("title", title))).length, 0,
    "Hosted fixture must start without an existing matching RFQ");
  assert.equal((await rows(session.api.from("buyer_distintas").select("id").eq("title", title))).length, 0,
    "Hosted fixture must start without an existing matching snapshot");
  await page.getByLabel("Titolo distinta", { exact: true }).fill(title);
  await page.locator("[data-private-calculator-grade] details > summary").click();
  await page.getByLabel("Grado acciaio · facoltativo ora", { exact: true }).fill("S355J2H");
  const calculator = page.locator("#calcolatore-pesi");
  for (const [index, length, quantity] of [[0, "6", "3"], [1, "12", "2"]]) {
    if (index) await calculator.getByRole("combobox", { name: "Norma", exact: true }).selectOption("en10210");
    await calculator.getByLabel("Lunghezza barra personalizzata", { exact: true }).fill(length);
    await calculator.getByLabel("Numero barre", { exact: true }).fill(quantity);
    await calculator.getByRole("button", { name: /Aggiungi alla distinta/ }).click();
    await page.getByTestId("private-cart-trigger").click();
    await page.waitForFunction(count =>
      document.querySelectorAll("#buyer-live-preview .bd10-preview-row:not([hidden])").length === count, index + 1);
    if (!index) await page.getByRole("dialog", { name: "Carrello della distinta privata" })
      .getByRole("button", { name: /^Chiudi/ }).click();
  }
  const bill = page.locator("#buyer-live-preview");
  assert.match(await bill.innerText(), /42(?:[,.]0+)? m/, "Review must show the complete 42 metres");
  assert.equal(await bill.locator(".bd10-preview-row:not([hidden])").count(), 2);
  const create = bill.getByRole("button", { name: /Crea RFQ privata/ });
  assert.equal(await create.isEnabled(), true, "Completed rows must be RFQ-ready");
  await usable(page);
  await create.click();
  await page.waitForURL(url => /^\/rfq-hub\/[0-9a-f-]{36}$/.test(url.pathname), { timeout: 90000 });
  await page.getByRole("heading", { name: title, exact: true }).waitFor({ timeout: 60000 });
  const campaigns = await rows(session.api.from("buyer_rfq_campaigns")
    .select("id,owner_user_id,source_distinta_id,status,marketplace_request_id,launched_at").eq("title", title));
  assert.equal(campaigns.length, 1, "One action must persist exactly one campaign");
  const campaign = campaigns[0];
  assert.equal(campaign.owner_user_id, session.userId);
  assert.equal(new URL(page.url()).pathname, "/rfq-hub/" + campaign.id);
  assert.equal(campaign.status, "draft");
  assert.equal(campaign.launched_at, null);
  assert.equal(campaign.marketplace_request_id, null);
  const lines = await verifySnapshot(session.api, campaign, title);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: title, exact: true }).waitFor({ timeout: 60000 });
  assert.equal((await rows(session.api.from("buyer_rfq_campaigns").select("id").eq("title", title))).length, 1);
  await verifySnapshot(session.api, campaign, title);
  for (const table of ["buyer_rfq_dispatches", "buyer_rfq_suppliers", "buyer_rfq_quotes"]) {
    assert.equal((await rows(session.api.from(table).select("id").eq("rfq_id", campaign.id))).length, 0,
      "Private acceptance must create no supplier, dispatch or quote");
  }
  assert.equal((await rows(session.api.from("buyer_distinta_deliveries").select("id")
    .eq("distinta_id", campaign.source_distinta_id))).length, 0, "Private bill must send nothing");
  await usable(page);
  return { campaign, lines };
}

async function main() {
  const config = hostedConfig();
  assert.equal(process.env.RESEND_API_KEY ?? "", "", "Hosted acceptance requires no email provider in the runner");
  const executable = process.env.DEMOTEST23_BROWSER_EXECUTABLE;
  assert.ok(!executable || executable.startsWith("/"), "Optional browser executable must be absolute");
  let browser;
  const sessions = [];
  try {
    currentCheck = "existing QA session A";
    const a = await openHostedSession("A", config); sessions.push(a);
    currentCheck = "existing QA session B";
    const b = await openHostedSession("B", config); sessions.push(b);
    browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : { channel: "chrome" }) });
    for (const width of [1440, 390]) {
      const aContext = await contextFor(browser, config, a, width);
      const bContext = await contextFor(browser, config, b, width);
      try {
        const aPage = await aContext.newPage();
        const bPage = await bContext.newPage();
        await step("A real unfiltered no-embedding search and calculator " + width,
          () => searchToCalculator(aPage, config, "A"));
        await step("B real unfiltered no-embedding search and calculator " + width,
          () => searchToCalculator(bPage, config, "B"));
        let created;
        await step("A exact two-line private draft and reload " + width, async () => {
          created = await createPrivateDraft(aPage, a, "FLOW1 HOSTED " + width);
        });
        await step("B cannot read A private draft in data or browser " + width, async () => {
          assert.equal((await rows(b.api.from("buyer_rfq_campaigns").select("id").eq("id", created.campaign.id))).length, 0);
          assert.equal((await rows(b.api.from("buyer_distintas").select("id").eq("id", created.campaign.source_distinta_id))).length, 0);
          assert.equal((await rows(b.api.from("buyer_distinta_lines").select("id").in("id", created.lines.map(line => line.id)))).length, 0);
          const response = await visit(bPage, config, "/rfq-hub/" + created.campaign.id);
          assert.equal(response.status(), 404, "Foreign RFQ must return not found");
          assert.equal(await bPage.getByRole("heading", { name: "FLOW1 HOSTED " + width, exact: true }).count(), 0);
          await usable(bPage);
        });
      } finally {
        await Promise.allSettled([aContext.close(), bContext.close()]);
      }
    }
  } finally {
    // A browser shutdown failure must never skip revoking either QA session.
    const closed = await Promise.allSettled([
      ...sessions.map(session => session.close()),
      ...(browser ? [browser.close()] : []),
    ]);
    assert.ok(closed.every(result => result.status === "fulfilled"), "Each hosted QA session must sign out locally");
  }
  console.log("FLOW1 HOSTED ACCEPTANCE PASS", completed,
    "isolated preview; existing QA A/B; 1440/390; search to private draft only; zero sends");
}

main().catch(error => {
  // No raw Playwright, Supabase, Flight, URL, cookie or token diagnostics.
  const code = /^FLOW1_HOSTED_[A-Z_]+$/.test(error?.message ?? "")
    ? error.message : "FLOW1_HOSTED_BROWSER_OR_DATA_CHECK";
  console.error("FLOW1 HOSTED FAIL", currentCheck, code);
  process.exitCode = 1;
});
