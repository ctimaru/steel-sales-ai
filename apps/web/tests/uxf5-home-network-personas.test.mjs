import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const network = fs.readFileSync(
  new URL("../components/public-network-role-explorer.tsx", import.meta.url),
  "utf8",
);

test("UXF5 puts the Network value explorer directly after the public hero", () => {
  assert.match(
    home,
    /surface=hero#calcolatore-pesi[\s\S]*<PublicNetworkRoleExplorer \/>[\s\S]*Prima utilità, poi prodotto/,
  );
});

test("UXF5 asks one role question and exposes only one role detail at a time", () => {
  assert.match(network, /Tu che azienda sei\?/);
  assert.match(network, /useState<PersonaKey>\("merchant"\)/);
  assert.match(network, /role="tablist"/);
  assert.match(network, /role="tab"/);
  assert.match(network, /role="tabpanel"/);
});

test("UXF5 answers benefits, counterparties and search value for all four company types", () => {
  for (const label of ["Commerciante", "Utilizzatore", "Terzista", "Produttore"]) {
    assert.match(network, new RegExp(label));
  }
  assert.match(network, /Che beneficio hai/);
  assert.match(network, /Chi puoi trovare/);
  assert.match(network, /Cosa puoi cercare/);
});

test("UXF5 makes who-produces-what concrete for merchants", () => {
  assert.match(network, /Chi produce cosa/);
  assert.match(network, /famiglia, norma, grado e capability/);
  assert.match(network, /Produttori, terzisti e utilizzatori/);
});

test("UXF5 keeps the real Network private and premium", () => {
  assert.match(network, /Privato · Premium/);
  assert.match(network, /aziende registrate e abilitate/);
  assert.doesNotMatch(network, /href="\/network"/);
  assert.match(network, /href="\/login"/);
  assert.match(network, /href="\/register"/);
});
