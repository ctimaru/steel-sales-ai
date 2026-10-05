import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);

test("PA1.1 public home leads with value before login", () => {
  assert.match(home, /Il business network/);
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
  assert.match(home, /<PublicCompanyLookup \/>/);
  assert.match(home, /La ricerca pubblica serve solo a riconoscere l&apos;identità aziendale/);
  assert.match(network, /Privato · Premium/);
  assert.doesNotMatch(home, /href="\/network"/);
});

test("PA1.1 aligns the public home with the current brand palette", () => {
  assert.match(home, /bg-\[#123d34\]/);
  assert.match(home, /platform-primary/);
  assert.doesNotMatch(home, /#2f6fed/);
  assert.doesNotMatch(home, /#245ed1/);
});

test("PA1.1 preserves authenticated-user redirect", () => {
  assert.match(home, /if \(data\.user\) redirect\("\/dashboard"\)/);
});
