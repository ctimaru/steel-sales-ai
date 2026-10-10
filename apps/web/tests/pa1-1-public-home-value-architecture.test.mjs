import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const network = fs.readFileSync(
  new URL("../components/public-network-role-explorer.tsx", import.meta.url),
  "utf8",
);

test("PA1.1 public home leads with value before login", () => {
  assert.match(home, /L’intelligenza che connette/);
  assert.match(home, /Utile anche senza account/);
  assert.match(home, /Prima utilità, poi prodotto/);
  assert.match(home, /Cercala per nome o Partita IVA/);
  assert.match(network, /Produttori/);
  assert.match(network, /Commercianti/);
  assert.match(network, /Terzisti/);
  assert.match(network, /Utilizzatori/);
});

test("PA1.1 exposes real public Scuola entry points", () => {
  assert.match(home, /href: "\/knowledge\/tubes\?source=home&surface=school_section#calcolatore-pesi"/);
  assert.match(home, /href: "\/knowledge\/norme"/);
  assert.match(home, /href: "\/knowledge\/gradi"/);
  assert.match(home, /Apri Scuola/);
});

test("PA1.1 public-value architecture remains intact after PA1.2 adds real company lookup", () => {
  assert.match(home, /Trova o rivendica la tua azienda/);
  assert.match(home, /<DeferredPublicCompanyLookup \/>/);
  assert.match(home, /La ricerca pubblica serve solo a riconoscere l&apos;identità aziendale/);
  assert.match(network, /Privato · Premium/);
  assert.doesNotMatch(home, /href="\/network"/);
});

test("PA1.1 aligns the public home with the current brand palette", () => {
  assert.match(home, /bg-\[#123b34\]/);
  assert.match(home, /platform-primary/);
  assert.doesNotMatch(home, /#2f6fed/);
  assert.doesNotMatch(home, /#245ed1/);
});

const proxy = fs.readFileSync(
  new URL("../lib/supabase/proxy.ts", import.meta.url),
  "utf8",
);

test("PA1.1 preserves authenticated-user redirect at the proxy before the static home", () => {
  assert.match(home, /export const dynamic = "force-static"/);
  assert.doesNotMatch(home, /createClient|getUser|cookies\s*\(|redirect\s*\(/);
  assert.match(proxy, /if \(!error && data\.user\)/);
  assert.match(proxy, /target\.pathname = "\/dashboard"/);
});
