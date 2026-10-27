import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const publicNav = fs.readFileSync(new URL("../components/public-home-navigation.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const header = fs.readFileSync(new URL("../components/public-home-header.tsx", import.meta.url), "utf8");
const hero = fs.readFileSync(new URL("../components/public-cinematic-hero.tsx", import.meta.url), "utf8");
const proxy = fs.readFileSync(new URL("../lib/supabase/proxy.ts", import.meta.url), "utf8");
const showcase = fs.readFileSync(new URL("../components/public-intelligence-showcase.tsx", import.meta.url), "utf8");

test("HOME-SI2 establishes a truthful AI-ready hero without claiming autonomous decisions", () => {
  assert.match(hero, /Super Intelligence Ready/);
  assert.match(hero, /L’acciaio ha una/);
  assert.match(home, /<PublicCinematicHero locale="it" \/>/);
  assert.match(showcase, /Flusso illustrativo/);
  assert.match(showcase, /L’AI assiste, la decisione resta alle persone/);
  assert.match(hero, /registrazione, verifica e abilitazione/);
  assert.match(home, /metadata: Metadata/);
  assert.doesNotMatch(home, /intelligenza artificiale generale|superintelligenza autonoma/i);
});

test("HOME-SI2 prioritizes conversion but preserves free utilities and role exploration", () => {
  assert.match(header, /"\/register"/);
  assert.match(hero, /Norme e pesi/);
  assert.match(home, /href="\/distinta"/);
  assert.match(home, /href="\/knowledge"/);
  assert.match(publicNav, /href: "\/azienda"/);
  assert.match(home, /<PublicNetworkRoleExplorer \/>/);
  assert.match(home, /<DeferredPublicCompanyLookup \/>/);
});

test("HOME-SI2 keeps public navigation and registration accessible on narrow screens", () => {
  assert.match(publicNav, /Navigazione mobile/);
  assert.match(publicNav, /xl:hidden/);
  assert.doesNotMatch(publicNav, /overflow-x-auto/);
  assert.match(header, /Area aziende/);
  assert.match(header, /Registra azienda/);
  assert.match(header, /min-h-11/);
  assert.match(hero, /aria-labelledby="home-cinematic-title"/);
});

test("HOME-SI2 keeps the landing static and does not add AI calls, fonts, or client runtime", () => {
  assert.match(home, /export const dynamic = "force-static"/);
  assert.doesNotMatch(home, /"use client"|useState|useEffect|fetch\s*\(|cookies\s*\(|createClient|headers\s*\(/);
  assert.doesNotMatch(home, /<Image|<video|autoplay|<Script/);
  assert.match(proxy, /target\.pathname = "\/dashboard"/);
});
