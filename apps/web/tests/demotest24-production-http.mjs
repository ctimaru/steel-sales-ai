/**
 * DEMOTEST2.4 — REAL production anonymous GET-only health/security gate.
 * Only the exact canonical host is permitted. No cookies, tokens, form submits,
 * logins, database writes, email, orders, or third-party outbound dispatch.
 * Run with Node 22: node tests/demotest24-production-http.mjs
 */
import assert from "node:assert/strict";

const BASE = "https://www.smartsteelsales.com";
const allowed = new Set(["www.smartsteelsales.com", "smartsteelsales.com"]);
const result = [];
const syntheticSecrets = [
  "DEMOTEST23 BUYER PRIVATE MIXED EN10210 EN10219",
  "DEMOTEST23 PRODUCER PRIVATE RFQ",
  "DEMOTEST23 TRADER PRIVATE RFQ",
  "DEMOTEST23 PROCESSOR PRIVATE RFQ",
];

function pass(label, detail) {
  result.push(label);
  console.log("DEMOTEST2.4 HTTP PASS", label, detail ?? "");
}

async function readOnly(pathname, host = BASE) {
  const url = new URL(pathname, host);
  assert.equal(url.protocol, "https:", "Production HTTPS is mandatory");
  assert.ok(allowed.has(url.hostname), "Unexpected external host denied");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    headers: {
      "user-agent": "SmartSteelSales-DemoTest2.4-ReadOnlyAcceptance/1.0",
      "accept": "text/html,application/xml,text/xml,text/plain;q=0.8",
    },
    signal: AbortSignal.timeout(30000),
  });
  const content = await response.text();
  assert.ok(content.length < 6_000_000, "Abnormal response size " + pathname);
  const redirectTo = response.headers.get("location") || "";
  const type = response.headers.get("content-type") || "";
  assert.ok(response.status < 500, pathname + " is unavailable (HTTP " + response.status + ")");
  return { status: response.status, content, redirectTo, type, response };
}

async function publicPage(path, fragments) {
  const page = await readOnly(path);
  assert.equal(page.status, 200, path + " must be available to anonymous readers");
  assert.match(page.type, /text\/html/i, path + " must render HTML");
  for (const fragment of fragments) {
    assert.ok(page.content.toLocaleLowerCase("it-IT").includes(fragment.toLocaleLowerCase("it-IT")),
      path + " is missing public content '" + fragment + "'");
  }
  for (const sentinel of syntheticSecrets) {
    assert.ok(!page.content.includes(sentinel), "Synthetic private RFQ exposed in public HTML " + path);
  }
  assert.ok(!page.content.includes("Questa sezione non è disponibile in questo momento"),
    path + " rendered a recovery error");
  pass("public " + path, "HTTP " + page.status);
  return page;
}

// One self-contained anonymous request per public route; no session persistence.
const publicHome = await publicPage("/", ["Smart Steel Sales"]);
assert.match(publicHome.content, /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.smartsteelsales\.com\/"|<link[^>]+href="https:\/\/www\.smartsteelsales\.com\/"[^>]+rel="canonical"/i,
  "Production canonical homepage must use www.smartsteelsales.com");
pass("production homepage canonical origin");
await publicPage("/knowledge", ["Conoscenza tecnica"]);
await publicPage("/knowledge/norme", ["Norme"]);
await publicPage("/knowledge/gradi", ["Gradi"]);
await publicPage("/knowledge/tubes", ["peso"]);
await publicPage("/distinta", ["Crea distinta"]);
const loginPage = await publicPage("/login", ["Accedi al tuo workspace"]);
const registerPage = await publicPage("/register", ["Registra"]);
for (const [path, page] of [["/login", loginPage], ["/register", registerPage]]) {
  assert.match(page.content, /name="robots"[^>]*noindex|noindex[^>]*name="robots"/i,
    path + " must be noindex; authentication forms are not SEO content");
  pass(path + " search indexing disabled");
}

const robots = await readOnly("/robots.txt");
assert.equal(robots.status, 200);
assert.match(robots.content, /Disallow:\s*\/platform\//i);
assert.match(robots.content, /Disallow:\s*\/dashboard/i);
assert.match(robots.content, /Disallow:\s*\/login/i);
assert.match(robots.content, /Sitemap:\s*https:\/\/www\.smartsteelsales\.com\/sitemap\.xml/i);
pass("robots.txt public/private boundaries");
const sitemap = await readOnly("/sitemap.xml");
assert.equal(sitemap.status, 200);
assert.match(sitemap.content, /<urlset|<sitemapindex/i);
assert.ok(sitemap.content.includes("https://www.smartsteelsales.com/knowledge"));
for (const privatePath of ["/dashboard", "/rfq-hub", "/platform", "/marketplace", "/login", "/register"]) {
  assert.ok(!sitemap.content.includes("https://www.smartsteelsales.com" + privatePath),
    privatePath + " must not appear in public sitemap");
}
pass("sitemap contains only indexable resources for named private surfaces");

// Production authorization must fail CLOSED for brand-new anonymous requests.
// A Next streaming shell or a 200 with private content can never be a PASS.
for (const path of [
  "/dashboard", "/rfq-hub",
  "/rfq-hub/00000000-0000-0000-0000-000000099999",
  "/marketplace", "/platform", "/company/profile", "/notifications",
]) {
  const p = await readOnly(path);
  const isLoginRedirect = [301, 302, 303, 307, 308].includes(p.status) &&
    (() => {
      if (!p.redirectTo) return false;
      const dest = new URL(p.redirectTo, BASE);
      return dest.origin === BASE && dest.pathname === "/login";
    })();
  // Some Next deployments render the form after resolving the redirect. Only
  // permit 200 when it is unmistakably the login page, not private content.
  const isLoginForm = p.status === 200 &&
    p.content.includes("Accedi al tuo workspace") &&
    /name="password"/i.test(p.content);
  assert.ok(isLoginRedirect || isLoginForm,
    path + " did not explicitly deny anonymous access (HTTP " + p.status + ")");
  assert.ok(!p.content.includes("Oggi in ") && !p.content.includes("Piattaforma · governance"),
    path + " leaked a private shell");
  for (const sentinel of syntheticSecrets) assert.ok(!p.content.includes(sentinel));
  pass("private " + path + " denies anonymous", "HTTP " + p.status);
}

const apex = await readOnly("/", "https://smartsteelsales.com");
const apexCanonical = [301, 302, 307, 308].includes(apex.status) &&
  (() => {
    if (!apex.redirectTo) return false;
    const target = new URL(apex.redirectTo, "https://smartsteelsales.com");
    return target.hostname === "www.smartsteelsales.com" && target.protocol === "https:";
  })();
assert.ok(apexCanonical || apex.status === 200,
  "apex domain must resolve to the canonical host or valid HTTPS homepage");
pass("apex HTTPS usable", "HTTP " + apex.status);

console.log("DEMOTEST2.4 HTTP SUCCESS — " + result.length +
  " read-only anonymous checks; production writes: 0; production logins: 0");
