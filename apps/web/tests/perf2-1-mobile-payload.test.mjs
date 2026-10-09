import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/page.tsx");
const layout = read("../app/layout.tsx");
const network = read("../components/public-network-role-explorer.tsx");
const css = read("../app/globals.css");
const deferred = read("../components/deferred-public-company-lookup.tsx");
const lookup = read("../components/public-company-lookup.tsx");
const registration = read("../app/register/page.tsx");
const proxy = read("../lib/supabase/proxy.ts");

test("PERF2.1 serves native Network role controls with no persona hydration", () => {
  assert.doesNotMatch(network, /"use client"/);
  assert.doesNotMatch(network, /useState|useEffect|onClick=/);
  assert.match(network, /type="radio"/);
  assert.match(network, /defaultChecked=\{key === "merchant"\}/);
  assert.match(network, /aria-controls/);
  assert.match(network, /role="region"/);
  for (const value of ["merchant", "user", "processor", "producer"]) {
    assert.match(css, new RegExp('value="' + value + '"\\]:checked'));
  }
  assert.match(css, /@supports selector\(:has\(\*\)\)/);
  assert.match(css, /perf21-network-panel\[data-network-persona="merchant"\]/);
});

test("PERF2.1 defers the public lookup chunk while leaving SEO text accessible", () => {
  assert.match(home, /<DeferredPublicCompanyLookup \/>/);
  assert.match(home, /Cercala per nome o Partita IVA/);
  assert.match(home, /La ricerca pubblica serve solo a riconoscere/);
  assert.match(deferred, /"use client"/);
  assert.match(deferred, /dynamic\(/);
  assert.match(deferred, /ssr: false/);
  assert.match(deferred, /IntersectionObserver/);
  assert.match(deferred, /rootMargin: "200px 0px"/);
  assert.match(deferred, /onClick=\{\(\) => setLoadSearch\(true\)\}/);
  assert.match(deferred, /href="\/azienda"/);
  assert.match(deferred, /min-h-\[280px\]/);
  assert.match(lookup, /onSubmit=\{handleSubmit\}/);
  assert.match(lookup, /fetch\("\/api\/public\/company-lookup"/);
  assert.match(registration, /<PublicCompanyLookup/);
});

test("PERF2.1 delays only external analytics library, not denied defaults or consent logic", () => {
  assert.match(layout, /import Script from "next\/script"/);
  assert.match(layout, /id="sss-google-analytics"/);
  assert.match(layout, /strategy="lazyOnload"/);
  assert.equal((layout.match(/id="sss-google-analytics"/g) || []).length, 1);
  assert.match(layout, /window\.gtag = window\.gtag \|\| function\(\)/);
  assert.match(layout, /analytics_storage: "denied"/);
  assert.match(layout, /wait_for_update: 500/);
  assert.match(layout, /send_page_view: false/);
  assert.match(layout, /GoogleAnalyticsConsent measurementId=\{googleAnalyticsId\}/);
});

test("PERF2.1 retains the static homepage and verified session redirect", () => {
  assert.match(home, /export const dynamic = "force-static"/);
  assert.doesNotMatch(home, /createClient\(|getUser\(/);
  assert.match(proxy, /if \(!error && data\.user\)/);
  assert.match(proxy, /target\.pathname = "\/dashboard"/);
  assert.match(home, /<PublicNetworkRoleExplorer \/>/);
});
