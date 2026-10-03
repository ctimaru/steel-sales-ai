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
  assert.match(home, /Trovala, rivendicala, rendila verificata/);
  assert.match(home, /Produttori/);
  assert.match(home, /Commercianti/);
  assert.match(home, /Terzisti/);
  assert.match(home, /Utilizzatori/);
});

test("PA1.1 exposes real public Scuola entry points", () => {
  assert.match(home, /href: "\/knowledge\/tubes"/);
  assert.match(home, /href: "\/knowledge\/norme"/);
  assert.match(home, /href: "\/knowledge\/gradi"/);
  assert.match(home, /Apri Scuola/);
});

test("PA1.1 keeps claim path truthful before VAT lookup ships", () => {
  assert.match(home, /Rivendica o registra la tua azienda/);
  assert.match(home, /Il company graph di Smart Steel Sales nasce da informazioni aziendali pubbliche/);
  assert.doesNotMatch(home, /name="vat"/);
  assert.doesNotMatch(home, /placeholder=.*Partita IVA/);
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
