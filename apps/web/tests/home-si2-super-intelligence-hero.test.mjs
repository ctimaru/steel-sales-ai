import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const proxy = fs.readFileSync(new URL("../lib/supabase/proxy.ts", import.meta.url), "utf8");
const showcase = fs.readFileSync(new URL("../components/public-intelligence-showcase.tsx", import.meta.url), "utf8");

test("HOME-SI2 establishes a truthful AI-ready hero without claiming autonomous decisions", () => {
  assert.match(home, /Super Intelligence Ready/);
  assert.match(home, /L’intelligenza che connette/);
  assert.match(home, /<PublicProductPreview \/>/);
  assert.match(showcase, /Flusso illustrativo/);
  assert.match(showcase, /L’AI assiste, la decisione resta alle persone/);
  assert.match(home, /richiedono registrazione e approvazione/);
  assert.match(home, /metadata: Metadata/);
  assert.doesNotMatch(home, /intelligenza artificiale generale|superintelligenza autonoma/i);
});

test("HOME-SI2 prioritizes conversion but preserves free utilities and role exploration", () => {
  assert.match(home, /href="\/register" className="platform-primary inline-flex min-h-12/);
  assert.match(home, /href="\/distinta"/);
  assert.match(home, /href="\/knowledge"/);
  assert.match(home, /href="\/azienda"/);
  assert.match(home, /<PublicNetworkRoleExplorer \/>/);
  assert.match(home, /<DeferredPublicCompanyLookup \/>/);
});

test("HOME-SI2 keeps public navigation and registration accessible on narrow screens", () => {
  assert.match(home, /aria-label="Navigazione pubblica mobile"/);
  assert.match(home, /lg:hidden/);
  assert.match(home, /overflow-x-auto/);
  assert.match(home, /<span className="sm:hidden">Registrati<\/span>/);
  assert.match(home, /min-h-11/);
  assert.match(home, /aria-labelledby="home-hero-title"/);
});

test("HOME-SI2 keeps the landing static and does not add AI calls, fonts, or client runtime", () => {
  assert.match(home, /export const dynamic = "force-static"/);
  assert.doesNotMatch(home, /"use client"|useState|useEffect|fetch\s*\(|cookies\s*\(|createClient|headers\s*\(/);
  assert.doesNotMatch(home, /<Image|<video|autoplay|<Script/);
  assert.match(proxy, /target\.pathname = "\/dashboard"/);
});
