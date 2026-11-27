/**
 * COMPANY-CLAIM1.A: real company lookup, member claim handoff and Free editing.
 * All accounts, claims, companies and contacts are disposable LOCAL fixtures.
 * No hosted URLs, external requests, UI mocks or production credentials allowed.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const base = process.env.DEMOTEST23_WEB_URL;
const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(base, "http://127.0.0.1:3000", "Hosted browser targets are forbidden");
assert.equal(dbUrl, "http://127.0.0.1:54321", "Hosted Supabase is forbidden");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true");
assert.equal(process.env.NETWORK_VISUAL_FIXTURE, "true");
assert.ok(process.env.RUNNER_TEMP);
const serviceKey = process.env.DEMOTEST23_LOCAL_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(serviceKey && anonKey, "Disposable local credentials required");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(dbUrl, serviceKey, options);
const anonymous = createClient(dbUrl, anonKey, options);
const people = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "demotest23-personas.json"), "utf8"));
const owner = people.find(person => person.id === "processor");
const observer = people.find(person => person.id === "trader");
const proReader = people.find(person => person.id === "buyer");
const viewer = people.find(person => person.id === "buyerViewer");
assert.ok(owner && observer && proReader && viewer);
const companyId = "00000000-0000-4000-8000-000000026171";
const observerCompanyId = "00000000-0000-4000-8000-000000026172";
const companyName = "DEMO CLAIM1A Acciaio S.r.l.";
const website = "https://claim1a.example.test";
const output = path.join(process.env.RUNNER_TEMP, "netro14d-synthetic-visual");
mkdirSync(output, { recursive: true });

async function rpc(client, name, args) {
  const result = await client.rpc(name, args);
  assert.equal(result.error, null, name + ": " + (result.error?.message ?? ""));
  return result.data;
}

async function signed(person) {
  const client = createClient(dbUrl, anonKey, options);
  const { error } = await client.auth.signInWithPassword({ email: person.email, password: person.password });
  assert.ifError(error);
  return client;
}

// Do not replace any link owned by a previous scenario. The dedicated processor
// and trader fixtures have no Network entitlement and no existing company link.
for (const person of [owner, observer]) {
  const { data, error } = await service.from("organization_network_company_links")
    .select("id").eq("organization_id", person.org).eq("link_status", "active");
  assert.ifError(error);
  assert.equal(data.length, 0, person.id + " must start without an active link");
}
const inserted = await service.from("network_companies").insert([
  { id: companyId, legal_name: companyName, country_code: "IT", website_url: website,
    website_domain: "claim1a.example.test", description: "DEMO profilo locale ancora da rivendicare.",
    publication_status: "published", claimed_status: "unclaimed", verification_status: "unverified" },
  { id: observerCompanyId, legal_name: "DEMO CLAIM1A Lettore Free S.r.l.", country_code: "IT",
    website_url: "https://claim1a-observer.example.test", website_domain: "claim1a-observer.example.test",
    publication_status: "published", claimed_status: "claimed", verification_status: "unverified" },
]);
assert.ifError(inserted.error);

async function localApprovedLink(person, targetId, existingClaimId = null) {
  const now = new Date().toISOString();
  const values = { status: "approved", reviewed_by: person.userId, reviewed_at: now,
    proof_method: "manual_review", proof_status: "verified", proof_verified_by: person.userId,
    proof_verified_at: now };
  const result = existingClaimId
    ? await service.from("network_company_claims").update(values).eq("id", existingClaimId)
      .eq("organization_id", person.org).eq("network_company_id", targetId).select("id").single()
    : await service.from("network_company_claims").insert({ ...values, network_company_id: targetId,
      organization_id: person.org, requested_by: person.userId }).select("id").single();
  assert.ifError(result.error);
  assert.ok(result.data?.id);
  const linked = await service.from("organization_network_company_links").insert({
    organization_id: person.org, network_company_id: targetId, claim_id: result.data.id,
    linked_by: person.userId, link_status: "active",
  });
  assert.ifError(linked.error);
  const marked = await service.from("network_companies").update({ claimed_status: "claimed" })
    .eq("id", targetId).select("id").single();
  assert.ifError(marked.error);
}
await localApprovedLink(observer, observerCompanyId);

const ownerClient = await signed(owner);
const observerClient = await signed(observer);
const proClient = await signed(proReader);
const viewerClient = await signed(viewer);
for (const [person, client] of [[owner, ownerClient], [observer, observerClient]]) {
  const access = await rpc(client, "pa1_3_network_access_state", { p_organization_id: person.org });
  assert.equal(access.can_access_network, false, person.id + " must exercise the Free path");
}
// This denied RPC remains denied throughout. A working /company/profile below
// therefore proves that Free own-profile management no longer depends on it.
const deniedPreferences = await ownerClient.rpc("p4_get_inquiry_preferences", { p_organization_id: owner.org });
assert.equal(deniedPreferences.error?.code, "42501");

const lookup = await rpc(anonymous, "pa1_2_company_lookup", { p_query: companyName });
assert.equal(lookup.ok, true);
assert.equal(lookup.items.length, 1);
const match = lookup.items[0];
assert.equal(match.legal_name, companyName);
assert.equal(match.claim_state, "claimable");
assert.match(match.claim_ref, /^[a-f0-9]{64}$/);
assert.equal(match.network_company_id, undefined, "Anonymous lookup must not reveal the internal company ID");
const registrationPath = "/register?claim_ref=" + match.claim_ref;
const claimPath = "/network/" + companyId + "/claim";
const eligibility = await rpc(ownerClient, "hp5_company_claim_experience", {
  p_network_company_id: companyId, p_organization_id: owner.org,
});
assert.equal(eligibility.eligible, true);
assert.equal(eligibility.network_company_id, companyId);
assert.equal(eligibility.proof_path, "manual_review");

for (const [name, args] of [
  ["hp5_company_claim_experience", { p_network_company_id: companyId, p_organization_id: viewer.org }],
  ["p3_6_request_company_claim", { p_network_company_id: companyId, p_organization_id: viewer.org, p_note: "DEMO denied viewer claim" }],
  ["p3_7d_upsert_contact", { p_network_company_id: companyId, p_contact_id: null,
    p_payload: { contact_type: "sales", email: "denied@claim1a.example.test", publication_status: "published" } }],
]) {
  const denied = await viewerClient.rpc(name, args);
  assert.equal(denied.error?.code, "42501", "Viewer denied by " + name);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
async function session(width) {
  const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 },
    locale: "it-IT", reducedMotion: "reduce", serviceWorkers: "block" });
  await context.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  const consoleIssues = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    const content = message.text();
    if (message.type() !== "error" && !(message.type() === "warning" && /hydration|validateDOMNesting|same key|cannot specify.*form|each child in a list/i.test(content))) return;
    const source = message.location().url;
    if (/Failed to load resource/i.test(content) && /^https?:/.test(source)
        && !["127.0.0.1", "localhost"].includes(new URL(source).hostname)) return;
    consoleIssues.push(content.slice(0, 24000));
  });
  return { context, page, width, errors, consoleIssues };
}
async function navigate(page, route) {
  const response = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (response) assert.ok(response.status() < 400, "Unexpected response on " + route + ": " + response.status());
}
async function login(page, person, target = null) {
  if (target !== null) await navigate(page, "/login?next=" + encodeURIComponent(target));
  await page.locator('input[name="email"]').fill(person.email);
  await page.locator('input[name="password"]').fill(person.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
}
async function capture(run, name) {
  const { page, width } = run;
  await page.evaluate(async () => { await document.fonts.ready; });
  const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(metrics.scroll <= metrics.width + 2, name + " overflow at " + width + ": " + JSON.stringify(metrics));
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await page.screenshot({ path: path.join(output, "company-claim1a-" + name + "-" + width + ".png"),
    fullPage: true, animations: "disabled", caret: "initial" });
  assert.deepEqual(run.errors, [], name + " page errors");
  assert.deepEqual(run.consoleIssues, [], name + " console errors/warnings");
}
async function diagnose(run, scenario) {
  console.error("COMPANY-CLAIM1.A failed scenario", { scenario, width: run.width,
    path: new URL(run.page.url()).pathname, errors: run.errors, consoleIssues: run.consoleIssues });
  await run.page.screenshot({ path: path.join(output, "company-claim1a-failed-" + scenario + "-" + run.width + ".png"),
    fullPage: true, animations: "disabled", caret: "initial" }).catch(() => {});
}

try {
  // The same anonymous claim reference survives the real registration and login
  // screens for an existing, unentitled workspace member at every viewport.
  for (const width of [1440, 390, 320]) {
    const run = await session(width);
    const { page, context } = run;
    try {
      await navigate(page, "/azienda");
      await page.getByRole("heading", { level: 1, name: "Rivendica il profilo della tua azienda." }).waitFor();
      const consent = page.getByRole("dialog", { name: "Cookie e privacy", exact: true });
      await consent.waitFor({ state: "visible", timeout: 30000 });
      await capture(run, "landing-with-consent");
      await consent.getByRole("button", { name: "Accetta necessari", exact: true }).click();
      await consent.waitFor({ state: "hidden" });
      const queryInput = page.locator('input[name="company_query"]');
      const queryBounds = await queryInput.boundingBox();
      assert.ok(queryBounds && queryBounds.height >= 47,
        "Company search input must retain a 48px touch target at " + width);
      await capture(run, "landing");
      await queryInput.fill(companyName);
      await page.getByRole("button", { name: "Cerca azienda", exact: true }).click();
      const result = page.locator("article").filter({ hasText: companyName });
      await result.waitFor({ state: "visible", timeout: 30000 });
      const claimLink = result.getByRole("link", { name: "Rivendica questa azienda", exact: true });
      assert.equal(await claimLink.getAttribute("href"), registrationPath);
      await capture(run, "lookup-result");
      await claimLink.click();
      await page.waitForURL(url => url.pathname === "/register", { timeout: 90000 });
      assert.equal(new URL(page.url()).searchParams.get("claim_ref"), match.claim_ref);
      assert.equal(await page.locator('input[name="next"]').inputValue(), registrationPath);
      const signIn = page.getByRole("link", { name: "Accedi", exact: true });
      assert.equal(await signIn.getAttribute("href"), "/login?next=" + encodeURIComponent(registrationPath));
      await signIn.click();
      await page.waitForURL(url => url.pathname === "/login", { timeout: 90000 });
      assert.equal(await page.locator('input[name="next"]').inputValue(), registrationPath);
      assert.equal(await page.getByRole("link", { name: "Crea account", exact: true }).getAttribute("href"), registrationPath);
      await login(page, owner);
      await page.waitForURL(url => url.pathname === claimPath, { timeout: 90000 });
      await page.getByRole("heading", { level: 1, name: "Richiedi la gestione di " + companyName, exact: true }).waitFor();
      assert.equal(await page.locator('input[name="network_company_id"]').inputValue(), companyId);
      assert.equal(await page.locator('input[name="authority_confirmed"]').isChecked(), false);
      await capture(run, "free-claim");
      // Direct visits by an already signed-in member must preserve the target too.
      await navigate(page, registrationPath);
      await page.waitForURL(url => url.pathname === claimPath, { timeout: 90000 });
      if (width === 390) {
        await navigate(page, "/en/register?claim_ref=" + match.claim_ref);
        await page.waitForURL(url => url.pathname === claimPath, { timeout: 90000 });
      }
      if (width === 320) {
        await page.locator('textarea[name="note"]').fill("DEMO locale CLAIM1A: richiesta sintetica del rappresentante aziendale.");
        await page.locator('input[name="authority_confirmed"]').check();
        await Promise.all([
          page.waitForURL(url => url.pathname === claimPath && (url.searchParams.has("message") || url.searchParams.has("error")), { timeout: 90000 }),
          page.getByRole("button", { name: "Invia richiesta di gestione", exact: true }).click(),
        ]);
        assert.equal(new URL(page.url()).searchParams.has("error"), false);
        await page.getByRole("heading", { level: 2, name: "Richiesta inviata", exact: true }).waitFor();
        await capture(run, "request-pending");
      }
    } catch (error) {
      await diagnose(run, "claim");
      throw error;
    } finally {
      await context.close();
    }
  }

  const requested = await rpc(ownerClient, "p3_6_my_company_claim", {
    p_network_company_id: companyId, p_organization_id: owner.org,
  });
  assert.equal(requested.status, "requested", "Submitting ownership proof must not auto-approve a claim");
  assert.equal(requested.proof_status, "pending");
  assert.equal(await rpc(ownerClient, "m8_my_network_company"), null, "Pending claim cannot manage the company");

  // Simulate staff approval only for this exact synthetic record, without adding
  // a staff role or relaxing any production rule. No approvals are fabricated
  // through the browser; this is the controlled setup for the editing scenario.
  await localApprovedLink(owner, companyId, requested.claim_id);
  const managed = await rpc(ownerClient, "m8_my_network_company");
  assert.equal(managed.network_company_id, companyId);
  const pendingContact = await rpc(ownerClient, "p3_7d_upsert_contact", {
    p_network_company_id: companyId, p_contact_id: null,
    p_payload: { contact_type: "sales", display_name: "DEMO contatto in revisione CLAIM1A",
      email: "commerciale@claim1a.example.test", publication_status: "published" },
  });
  assert.equal(pendingContact.publication_status, "pending_review");
  assert.equal(pendingContact.privacy_review_required, true);
  const draftContact = await rpc(ownerClient, "p3_7d_upsert_contact", {
    p_network_company_id: companyId, p_contact_id: null,
    p_payload: { contact_type: "general", display_name: "DEMO bozza privata CLAIM1A",
      email: "bozza@claim1a.example.test", publication_status: "draft" },
  });
  assert.equal(draftContact.publication_status, "draft");

  const readerRun = await session(1440);
  try {
    await login(readerRun.page, observer, "/dashboard");
    await readerRun.page.waitForURL(url => url.pathname === "/dashboard", { timeout: 90000 });
    for (const width of [1440, 390, 320]) {
      const run = await session(width);
      const { page, context } = run;
      try {
        await login(page, owner, "/company/profile");
        await page.waitForURL(url => url.pathname === "/company/profile", { timeout: 90000 });
        await page.getByTestId("company-workspace").waitFor({ state: "visible", timeout: 30000 });
        const visibility = page.getByTestId("company-profile-visibility");
        assert.match(await visibility.innerText(), /La tua vista: Network Free/);
        await visibility.locator("summary").click();
        assert.match(await visibility.innerText(), /non è una pagina aperta/);
        assert.equal(await page.getByRole("link", { name: "Vedi profilo nel Network", exact: true }).getAttribute("href"), "/network/" + companyId);
        await capture(run, "free-profile-summary");

        const navigation = page.getByRole("navigation", { name: "Gestione azienda", exact: true });
        await navigation.getByRole("link", { name: "Identità aziendale", exact: true }).click();
        await page.getByTestId("company-overview-form").waitFor({ state: "visible" });
        const description = "DEMO CLAIM1A " + width + ". Lavorazioni di carpenteria e taglio tubi dichiarate dall’azienda nel collaudo locale.";
        await page.locator("#company-description").fill(description);
        await Promise.all([
          page.waitForURL(url => url.searchParams.has("message") || url.searchParams.has("error"), { timeout: 90000 }),
          page.getByRole("button", { name: "Salva overview", exact: true }).click(),
        ]);
        assert.equal(new URL(page.url()).searchParams.has("error"), false);
        await page.getByTestId("company-overview-form").waitFor({ state: "visible" });
        assert.equal(await page.locator("#company-description").inputValue(), description);
        await capture(run, "description-saved");
        const shared = await rpc(observerClient, "netux11_free_profile", { p_organization_id: observer.org, p_company_id: companyId });
        assert.equal(shared.company.description, description, "A different Free organization reads the saved canonical description");
        assert.equal(shared.company.description_is_company_declared, true);
        await readerRun.page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
        readerRun.width = width;
        await navigate(readerRun.page, "/network/" + companyId);
        // This fixture deliberately has no crawler research. Its canonical
        // description renders directly in the activity panel, without the
        // research-only declared-description wrapper used by C.1's scenarios.
        const declared = readerRun.page.getByTestId("network-company-panel-attivita")
          .getByText(description, { exact: true });
        await declared.waitFor({ state: "visible", timeout: 30000 });
        assert.equal(await declared.innerText(), description);
        await capture(readerRun, "second-company-free-view");

        await navigate(page, "/company/profile#contacts");
        const pendingCard = page.locator('[data-testid="company-contact-card"][data-publication-status="pending_review"]');
        const draftCard = page.locator('[data-testid="company-contact-card"][data-publication-status="draft"]');
        await pendingCard.waitFor({ state: "visible", timeout: 30000 });
        assert.equal(await pendingCard.getByText("In revisione", { exact: true }).count(), 1);
        assert.equal(await pendingCard.getByText("Bozza privata", { exact: true }).count(), 0);
        assert.equal(await pendingCard.locator('select[name="publication_status"]').inputValue(), "published");
        assert.equal(await draftCard.getByText("Bozza privata", { exact: true }).count(), 1);
        assert.equal(await draftCard.locator('select[name="publication_status"]').inputValue(), "draft");
        if (width === 1440) {
          await Promise.all([
            page.waitForURL(url => url.searchParams.has("message") || url.searchParams.has("error"), { timeout: 90000 }),
            pendingCard.getByRole("button", { name: "Salva contatto", exact: true }).click(),
          ]);
          const feedback = new URL(page.url()).searchParams;
          assert.equal(feedback.has("error"), false);
          assert.match(feedback.get("message"), /revisione/i, "Successful save must reflect the actual pending status");
          assert.doesNotMatch(feedback.get("message"), /pubblicato/i);
          await pendingCard.waitFor({ state: "visible", timeout: 30000 });
        }
        await capture(run, "contact-review-and-draft");
        const contacts = await rpc(proClient, "p3_7d_public_identity_contacts", { p_network_company_id: companyId });
        assert.ok(!(contacts.contacts ?? []).some(contact => [pendingContact.contact_id, draftContact.contact_id].includes(contact.id)),
          "Neither pending nor draft contact is returned by the public profile reader");
        assert.doesNotMatch(await readerRun.page.locator("body").innerText(), /commerciale@claim1a|bozza@claim1a/);

        await navigation.getByRole("link", { name: "Preferenze di contatto", exact: true }).click();
        await page.getByTestId("company-inquiries-unavailable").waitFor({ state: "visible" });
        await page.getByRole("heading", { name: "Richieste commerciali con Network PRO", exact: true }).waitFor();
        assert.equal(await page.locator('input[name="inquiries_enabled"]').count(), 0, "Free UI cannot mutate Pro inquiry settings");
        await capture(run, "free-inquiry-boundary");
      } catch (error) {
        await diagnose(run, "profile");
        throw error;
      } finally {
        await context.close();
      }
    }
  } catch (error) {
    await diagnose(readerRun, "reader");
    throw error;
  } finally {
    await readerRun.context.close();
  }

  const viewerRun = await session(390);
  try {
    await login(viewerRun.page, viewer, "/dashboard");
    await viewerRun.page.waitForURL(url => url.pathname === "/dashboard", { timeout: 90000 });
    await navigate(viewerRun.page, claimPath);
    await viewerRun.page.waitForURL(url => url.pathname !== claimPath, { timeout: 90000 });
    assert.equal(await viewerRun.page.locator('input[name="authority_confirmed"]').count(), 0);
    await navigate(viewerRun.page, "/company/profile");
    assert.equal(await viewerRun.page.getByTestId("company-overview-form").count(), 0);
    assert.equal(await viewerRun.page.getByRole("button", { name: "Salva contatto", exact: true }).count(), 0);
    await capture(viewerRun, "viewer-denied");
  } catch (error) {
    await diagnose(viewerRun, "viewer");
    throw error;
  } finally {
    await viewerRun.context.close();
  }
  assert.equal((await rpc(ownerClient, "pa1_3_network_access_state", { p_organization_id: owner.org })).can_access_network, false);
  assert.equal((await ownerClient.rpc("p4_get_inquiry_preferences", { p_organization_id: owner.org })).error?.code, "42501");
  console.log("COMPANY-CLAIM1.A PASS: real lookup/login/member handoff, Free claim + own-profile editing, second-tenant readback, pending/draft privacy, viewer denial; 1440/390/320 screenshots.");
} finally {
  await browser.close();
  await Promise.all([ownerClient, observerClient, proClient, viewerClient].map(client => client.auth.signOut()));
}
