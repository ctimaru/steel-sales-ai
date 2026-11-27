import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// HOME-CALC1: the Italian public home in five blocks, led by a quick weight.
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/(italian)/page.tsx");
const en = read("../app/(english)/en/page.tsx");
const hero = read("../components/public-cinematic-hero.tsx");
const quick = read("../components/home-quick-weight.tsx");
const proof = read("../components/public-steel-geometry-proof.tsx");
const nav = read("../components/public-home-navigation.tsx");
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve },
  reportDiagnostics: true,
});

test("HOME-CALC1 home keeps only hero, how it works, company lookup, contacts and footer", () => {
  for (const removed of ["<PublicNetworkRoleExplorer", "<PublicIntelligencePillars", "<HomeCinematicTools", "<PublicRegistrationTrust"]) {
    assert.ok(!home.includes(removed), removed);
  }
  assert.match(home, /<PublicCinematicHero locale="it" \/>[\s\S]*<PublicSteelGeometryProof locale="it" tools=\{publicTools\} \/>[\s\S]*<DeferredPublicCompanyLookup \/>[\s\S]*<PublicContactSection locale="it" \/>[\s\S]*<footer/);
  // English home is unchanged by this pass.
  assert.match(en, /<HomeCinematicTools locale="en" \/>/);
  assert.doesNotMatch(home, /Super Intelligence Ready/);
  assert.match(home, /href: "\/knowledge\/norme"/);
  assert.match(home, /href: "\/knowledge\/gradi"/);
  assert.match(nav, /\{ label: "Network", href: "#network-pro" \}/);
});

test("HOME-CALC1 hero says what the platform does and answers with a weight", () => {
  assert.match(hero, /"Pesi, distinte e fornitori"/);
  assert.match(hero, /" per chi lavora l’acciaio\."/);
  assert.match(hero, /\{en \? null : <HomeQuickWeight \/>\}/);
  assert.match(hero, /Oppure crea una distinta gratis/);
  assert.match(proof, /Calcola, prepara la distinta, trova i fornitori\./);
  for (const source of [hero, quick, proof]) {
    assert.equal(transpile(source).diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  }
});

test("HOME-CALC1 quick weight uses the shared engine, stores and sends nothing", () => {
  assert.match(quick, /"use client"/);
  assert.match(quick, /calculateTubeSection\(\{/);
  assert.match(quick, /standard: "en10219"/);
  assert.match(quick, /parseTypedDimension\(query\)/);
  assert.match(quick, /#calcolatore-pesi/);
  assert.match(quick, /surface: "hero"/);
  assert.doesNotMatch(quick, /fetch\(|localStorage|sessionStorage|supabase|trackProductEvent/);
  assert.match(quick, /aria-live="polite"/);
  assert.match(quick, /<label htmlFor=\{inputId\}/);
});
