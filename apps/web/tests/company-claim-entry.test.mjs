import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const companyId = "00000000-0000-4000-8000-000000026300";
const organizationId = "00000000-0000-4000-8000-000000026301";
const otherOrganizationId = "00000000-0000-4000-8000-000000026302";
const claimRef = "a".repeat(64);
const user = { id: "00000000-0000-4000-8000-000000026303", email: "admin@example.test", email_confirmed_at: "2026-11-27T10:00:00Z" };
const redirect = (path) => { throw Object.assign(new Error("redirect"), { path }); };
const notFound = () => { throw Object.assign(new Error("not found"), { status: 404 }); };
const jsx = (type, props) => ({ type, props: props ?? {} });
const elementModules = {
  "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
  "next/link": { default: "link", __esModule: true },
  "next/navigation": { redirect, notFound },
};
const sources = new Map();
function load(path, imports = {}, globals = {}) {
  if (!sources.has(path)) sources.set(path, ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } },
  ).outputText);
  const exports = {};
  vm.runInNewContext(sources.get(path), {
    exports, URL, URLSearchParams, FormData, console,
    require: (specifier) => {
      if (specifier in imports) return imports[specifier];
      if (specifier in elementModules) return elementModules[specifier];
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
    ...globals,
  });
  return exports;
}
const authNext = load("../lib/auth-next.ts");
const intent = load("../lib/company-claim-intent.ts", { "@/lib/auth-next": authNext });
const claimPath = `/network/${companyId}/claim`;
const registrationPath = `/register?claim_ref=${claimRef}`;
const enRegistrationPath = `/en/register?claim_ref=${claimRef}`;

function targetResult(overrides = {}) {
  return { contract: "company-claim1a-target-v1", ok: true, code: "resolved", network_company_id: companyId, ...overrides };
}

function rpcClient(responses, calls = []) {
  return { rpc: async (name, args) => {
    calls.push({ name, args });
    if (!(name in responses)) throw new Error(`Unexpected RPC: ${name}`);
    const response = responses[name];
    if (response instanceof Error) throw response;
    return response;
  } };
}

function entryHelper(client) {
  return load("../lib/company-claim-entry.ts", {
    "server-only": {},
    "@/lib/company-claim-intent": intent,
    "@/lib/supabase/server": { createClient: async () => client },
  });
}

test("claim login intent accepts only exact IT/EN registration routes and one valid opaque reference", () => {
  for (const path of [registrationPath, enRegistrationPath]) {
    assert.equal(intent.registrationClaimNext(path), path);
    assert.equal(intent.registrationClaimNext(path.replace(claimRef, claimRef.toUpperCase())), path);
    assert.equal(intent.registrationClaimNext(path + "&company_id=" + companyId + "#untrusted"), path);
  }
  assert.equal(intent.registrationClaimNext(registrationPath + "&return_to=%2Fnetwork%3Fq%3Dprivate"), registrationPath + "&return_to=%2Fnetwork");
  for (const value of [
    undefined, "", "/register", "/register?claim_ref=bad", "/registration/status?claim_ref=" + claimRef,
    "/register-extra?claim_ref=" + claimRef, "https://evil.test" + registrationPath,
    "//evil.test" + registrationPath, registrationPath + "&claim_ref=" + claimRef,
  ]) assert.equal(intent.registrationClaimNext(value), null, String(value));
  for (const value of [null, 123, [claimRef], {}, "not-a-ref"]) assert.equal(intent.normalizeCompanyClaimRef(value), null);
});

test("member entry resolves exact company server-side and keeps it through legal acceptance", async () => {
  for (const accepted of [true, false]) {
    const calls = [];
    const helper = entryHelper(rpcClient({
      company_claim1a_resolve_target: { data: targetResult(), error: null },
      lr5_current_legal_acceptance_state: { data: { accepted }, error: null },
    }, calls));
    await assert.rejects(helper.continueCompanyClaimForMember(claimRef, organizationId),
      (error) => error.path === (accepted ? claimPath : "/legal/accept?next=" + encodeURIComponent(claimPath)));
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
      { name: "company_claim1a_resolve_target", args: { p_claim_ref: claimRef, p_organization_id: organizationId } },
      { name: "lr5_current_legal_acceptance_state" },
    ]);
  }
});

test("entry distinguishes denied admins, unavailable targets and service failures without granting control", async () => {
  const cases = [
    [{ data: null, error: { code: "42501" } }, "not_admin"],
    [{ data: targetResult({ ok: false, code: "target_unavailable", network_company_id: null }), error: null }, "target_unavailable"],
    [{ data: null, error: { code: "PGRST202" } }, "unavailable"],
    [new Error("transport failure"), "unavailable"],
    [{ data: null, error: null }, "unavailable"],
    [{ data: targetResult({ contract: "other-version" }), error: null }, "unavailable"],
    [{ data: targetResult({ network_company_id: "https://evil.test" }), error: null }, "unavailable"],
    [{ data: targetResult({ ok: "true" }), error: null }, "unavailable"],
  ];
  for (const [reply, expected] of cases) {
    const calls = [];
    const helper = entryHelper(rpcClient({ company_claim1a_resolve_target: reply }, calls));
    assert.equal(await helper.continueCompanyClaimForMember(claimRef, organizationId), expected);
    assert.equal(calls.length, 1);
  }
  const calls = [];
  const helper = entryHelper(rpcClient({}, calls));
  assert.equal(await helper.continueCompanyClaimForMember("invalid", organizationId), "target_unavailable");
  assert.equal(await helper.continueCompanyClaimForMember(claimRef, "invalid"), "unavailable");
  assert.equal(calls.length, 0);
  const failedClient = load("../lib/company-claim-entry.ts", {
    "server-only": {}, "@/lib/company-claim-intent": intent,
    "@/lib/supabase/server": { createClient: async () => { throw new Error("client unavailable"); } },
  });
  assert.equal(await failedClient.continueCompanyClaimForMember(claimRef, organizationId), "unavailable");
});

test("legal lookup failures retain the selected company instead of redirecting to another destination", async () => {
  for (const legal of [new Error("transport"), { data: null, error: { code: "503" } }]) {
    const helper = entryHelper(rpcClient({
      company_claim1a_resolve_target: { data: targetResult(), error: null },
      lr5_current_legal_acceptance_state: legal,
    }));
    assert.equal(await helper.continueCompanyClaimForMember(claimRef, organizationId), "unavailable");
  }
});

function chainQuery(result) {
  const chain = { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
  for (const method of ["select", "eq", "order", "limit", "maybeSingle"]) chain[method] = () => chain;
  return chain;
}

function registrationPage(locale, { members, membershipError = null, entry = async () => "unavailable", signedIn = true } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: signedIn ? user : null } }) },
    rpc: async (name) => {
      calls.push(name);
      if (name === "lr5_account_lifecycle_state") return { data: { access_suspended: false }, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
    from: (table) => {
      calls.push(table);
      if (table === "organization_memberships") return chainQuery({ data: members, error: membershipError });
      throw new Error(`Unexpected table ${table}`);
    },
  };
  const placeholders = [
    ["@/app/login/actions", ["signup"]], ["@/app/register/actions", ["logoutRegistration"]],
    ["./actions", ["logoutRegistration"]],
    ["./registration-form", ["CompanyRegistrationForm"]],
    ["@/components/company-registration-form", ["CompanyRegistrationForm"]],
    ["@/components/english-company-registration-form", ["EnglishCompanyRegistrationForm"]],
    ["@/components/pending-submit-button", ["PendingSubmitButton"]], ["@/components/product-brand", ["ProductBrand"]],
    ["@/components/public-company-lookup", ["PublicCompanyLookup"]], ["@/components/registration-journey", ["RegistrationJourney"]],
    ["@/components/registration-pilot-notice", ["RegistrationPilotNotice"]], ["@/components/ui/input", ["Input"]],
  ];
  const imports = Object.fromEntries(placeholders.map(([name, exports]) => [name, Object.fromEntries(exports.map((key) => [key, key]))]));
  Object.assign(imports, {
    "@/components/company-claim-entry-notice": { CompanyClaimEntryNotice: "ClaimEntryNotice" },
    "@/lib/company-claim-entry": { continueCompanyClaimForMember: entry },
    "@/lib/company-claim-intent": intent,
    "@/lib/auth-next": authNext,
    "@/lib/registration-access": { registrationPilotGateActive: () => false, pilotEmailAllowed: () => true },
    "@/lib/registration-state": {},
    "@/lib/seo": { privateNoIndexRobots: {} },
    "@/lib/url-feedback": { safeUrlFeedback: () => null },
    "@/lib/supabase/server": { createClient: async () => client },
  });
  const path = locale === "en" ? "../app/(english)/en/register/page.tsx" : "../app/(italian)/register/page.tsx";
  return { page: load(path, imports).default, calls };
}

test("IT and EN members continue the selected claim using their default active organization", async () => {
  for (const locale of ["it", "en"]) {
    const entries = [];
    const { page, calls } = registrationPage(locale, {
      members: [{ organization_id: otherOrganizationId, is_default: false }, { organization_id: organizationId, is_default: true }],
      entry: async (...args) => { entries.push(args); return "not_admin"; },
    });
    const view = await page({ searchParams: Promise.resolve({ claim_ref: claimRef }) });
    assert.deepEqual(entries, [[claimRef, organizationId]]);
    assert.equal(view.type, "ClaimEntryNotice");
    assert.equal(view.props.status, "not_admin");
    assert.equal(view.props.retryHref, locale === "en" ? enRegistrationPath : registrationPath);
    assert.equal(calls.includes("company_registration_applications"), false);
  }
});

test("membership lookup failure keeps IT/EN claim intent and cannot open a duplicate registration form", async () => {
  for (const locale of ["it", "en"]) {
    const { page, calls } = registrationPage(locale, { members: null, membershipError: { code: "503" }, entry: () => assert.fail("no membership authority") });
    const view = await page({ searchParams: Promise.resolve({ claim_ref: claimRef }) });
    assert.equal(view.type, "ClaimEntryNotice");
    assert.equal(view.props.status, "unavailable");
    assert.match(view.props.retryHref, new RegExp(claimRef));
    assert.equal(calls.includes("company_registration_applications"), false);
  }
});

test("ordinary member registration still goes to dashboard and malformed refs never reach a resolver", async () => {
  for (const locale of ["it", "en"]) {
    const { page } = registrationPage(locale, { members: [{ organization_id: organizationId }], entry: () => assert.fail("unexpected claim resolver") });
    await assert.rejects(page({ searchParams: Promise.resolve({}) }), (error) => error.path === "/dashboard");
    await assert.rejects(page({ searchParams: Promise.resolve({ claim_ref: "invalid" }) }),
      (error) => error.path === (locale === "en" ? "/en/register" : "/#aziende"));
  }
});

function loginAction({ legalAccepted = true, staff = false, suspended = false, setupComplete = true } = {}) {
  const calls = [];
  const client = {
    auth: {
      signInWithPassword: async () => ({ error: null }),
      signOut: async () => { calls.push("signOut"); return { error: null }; },
    },
    rpc: async (name) => {
      calls.push(name);
      if (name === "lr5_account_lifecycle_state") return { data: { access_suspended: suspended } };
      if (name === "platform_access_context") return { data: staff ? { is_platform_staff: true, staff_status: "active", permissions: ["platform.console.access"] } : {} };
      if (name === "lr5_current_legal_acceptance_state") return { data: { accepted: legalAccepted } };
      if (["claim_pending_organization_invitations", "sa2_claim_platform_staff_invitation"].includes(name)) return { data: {} };
      throw new Error(`Unexpected RPC ${name}`);
    },
    from: (table) => {
      if (table === "organization_memberships") return chainQuery({ data: [{ organization_id: organizationId, is_default: true, status: "active" }], error: null });
      if (table === "organizations") return chainQuery({ data: { guided_setup_completed_at: setupComplete ? "2026-11-27" : null }, error: null });
      throw new Error(`Unexpected table ${table}`);
    },
  };
  const actions = load("../app/(italian)/login/actions.ts", {
    "next/headers": { cookies: async () => ({ delete: () => {} }), headers: async () => ({ get: () => null }) },
    "@/lib/auth-email-verification": { PENDING_SIGNUP_EMAIL_COOKIE: "email", PENDING_SIGNUP_NEXT_COOKIE: "next", pendingSignupEmailCookieOptions: {} },
    "@/lib/auth-next": authNext,
    "@/lib/company-claim-intent": intent,
    "@/lib/site": { siteUrl: "https://www.smartsteelsales.com" },
    "@/lib/product-analytics-events.server": { trackServerProductEvent: async () => {} },
    "@/lib/registration-access": { pilotGateMessage: () => "pilot", registrationAllowedFor: () => true },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/user-facing-error": { safeErrorMessage: () => "safe error" },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: "http://test.local", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-test" } } });
  return { login: actions.login, calls };
}

function loginForm(next) {
  const data = new FormData();
  data.set("email", "admin@example.test"); data.set("password", "test-passphrase"); data.set("next", next);
  return data;
}

test("real login action preserves IT/EN claim intent for existing members, including before setup and legal acceptance", async () => {
  for (const next of [registrationPath, enRegistrationPath]) {
    for (const legalAccepted of [true, false]) {
      const { login } = loginAction({ legalAccepted, setupComplete: false });
      await assert.rejects(login(loginForm(next)), (error) => error.path === (legalAccepted ? next : "/legal/accept?next=" + encodeURIComponent(next)));
    }
  }
});

test("claim intent never overrides suspended-account or platform-staff routing and unrelated member login is unchanged", async () => {
  const staff = loginAction({ staff: true });
  await assert.rejects(staff.login(loginForm(registrationPath)), (error) => error.path === "/platform");
  const suspended = loginAction({ suspended: true });
  await assert.rejects(suspended.login(loginForm(registrationPath)), (error) => error.path === "/account-closure?requested=1");
  assert.ok(suspended.calls.includes("signOut"));
  for (const next of ["/register", "/en/register", "/register?claim_ref=invalid"]) {
    await assert.rejects(loginAction().login(loginForm(next)), (error) => error.path === "/dashboard");
  }
});

function experience(overrides = {}) {
  return {
    network_company_id: companyId, organization_id: organizationId,
    legal_name: "Acciai di Prova S.r.l.", trading_name: null, country_code: "IT", website_domain: "example.test",
    organization_name: "Account aziendale di prova", publication_status: "published", claimed_status: "unclaimed",
    verification_status: "unverified", eligible: true, eligibility_reason: "eligible",
    proof_reason: "unique_company_domain_match", company_domain_profile_count: 1, current_claim: null,
    ...overrides,
  };
}

function claimPage({ reply = { data: experience(), error: null }, role = "admin" } = {}) {
  const calls = [];
  const claims = load("../lib/company-claims.ts", { "@/lib/supabase/server": { createClient: async () => rpcClient({ hp5_company_claim_experience: reply }, calls) } });
  const page = load("../app/(italian)/(workspace)/network/[id]/claim/page.tsx", {
    "@/app/(workspace)/network/actions": { requestNetworkClaim: "requestNetworkClaim" },
    "@/components/pending-submit-button": { PendingSubmitButton: "submit" },
    "@/lib/company-claims": claims,
    "@/lib/network-flags": { isNetworkFrontendEnabled: () => true },
    "@/lib/workspace-context": { requireWorkspaceAdmin: async (fallback) => {
      if (role !== "admin") redirect(fallback);
      return { organizationId, role, can_access_network: false };
    } },
  }).default;
  return { page, calls };
}

function nodes(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((node) => nodes(node, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const textContent = (tree) => typeof tree === "string" ? tree : Array.isArray(tree) ? tree.map(textContent).join(" ") : tree && typeof tree === "object" ? textContent(tree.props?.children) : "";
const renderClaim = (page, id = companyId) => page({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });

test("Free admin claim loads exclusively HP5, renders the governed form and does not require a Pro profile reader", async () => {
  const { page, calls } = claimPage();
  const view = await renderClaim(page);
  assert.equal(nodes(view, (node) => node.type === "form").length, 1);
  assert.match(textContent(view), /Acciai di Prova/);
  assert.match(textContent(view), /richiesta di gestione resta soggetta all’approvazione/);
  assert.match(textContent(view), /non equivale alla verifica della società/);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ name: "hp5_company_claim_experience", args: { p_network_company_id: companyId, p_organization_id: organizationId } }]);
});

test("non-admins are stopped before HP5 and invalid UUIDs never query company data", async () => {
  for (const role of ["viewer", "member"]) {
    const { page, calls } = claimPage({ role });
    await assert.rejects(renderClaim(page), (error) => error.path === "/company/profile");
    assert.equal(calls.length, 0);
  }
  const { page, calls } = claimPage();
  await assert.rejects(renderClaim(page, "invalid"), (error) => error.status === 404);
  assert.equal(calls.length, 0);
});

test("claim not-found, revoked access and malformed RPC responses fail closed without a form", async () => {
  for (const [reply, expected] of [
    [{ data: null, error: { code: "P0002" } }, (e) => e.status === 404],
    [{ data: null, error: { code: "42501" } }, (e) => e.path === "/dashboard"],
    [{ data: null, error: { code: "503", message: "private database message" } }, (e) => e.message === "company_claim_experience_unavailable"],
    ...[null, {}, experience({ network_company_id: otherOrganizationId }), experience({ organization_id: otherOrganizationId }), experience({ eligible: "true" }), experience({ publication_status: "draft" })]
      .map((data) => [{ data, error: null }, (e) => e.message === "company_claim_experience_unavailable"]),
  ]) await assert.rejects(renderClaim(claimPage({ reply }).page), expected);
});

test("existing requests and ownership blockers never render another claim form", async () => {
  for (const status of ["requested", "under_review", "approved"]) {
    const current_claim = { status, proof_status: "verified", proof_method: "authenticated_corporate_email" };
    const { page } = claimPage({ reply: { data: experience({ eligible: false, eligibility_reason: status === "approved" ? "already_managed" : "claim_in_progress", current_claim }), error: null } });
    const view = await renderClaim(page);
    assert.equal(nodes(view, (node) => node.type === "form").length, 0);
    assert.equal(nodes(view, (node) => node.props?.href === "/company/profile").length, status === "approved" ? 1 : 0);
  }
  const blocked = await renderClaim(claimPage({ reply: { data: experience({
    eligible: false, eligibility_reason: "already_claimed", current_claim: { status: "rejected", proof_status: "rejected" },
  }), error: null } }).page);
  assert.equal(nodes(blocked, (node) => node.type === "form").length, 0);
  assert.match(textContent(blocked), /già gestito da un’altra azienda/);
  const linked = await renderClaim(claimPage({ reply: { data: experience({ eligible: false, eligibility_reason: "already_managed" }), error: null } }).page);
  assert.equal(nodes(linked, (node) => node.props?.href === "/company/profile").length, 1);
});
