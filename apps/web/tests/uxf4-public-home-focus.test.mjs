import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const publicNav = fs.readFileSync(new URL("../components/public-home-navigation.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const hero = fs.readFileSync(new URL("../components/public-cinematic-hero.tsx", import.meta.url), "utf8");
const network = fs.readFileSync(
  new URL("../components/public-network-role-explorer.tsx", import.meta.url),
  "utf8",
);

test("UXF4 preserves public discovery links in both desktop and mobile header", () => {
  assert.match(home, /<PublicHomeNavigation locale="it"/);
  assert.match(publicNav, /Navigazione mobile/);
  assert.match(publicNav, /surface=header#calcolatore-pesi/);
  assert.match(publicNav, /Calcolo pesi/);
  assert.match(home, /href="\/distinta"/);
  assert.match(home, /href="\/azienda"/);
  assert.doesNotMatch(home, />\s*Calcolatore\s*</);
});

test("UXF4 prioritizes registration while keeping a no-account utility CTA", () => {
  assert.match(hero, /register: "\/register"/);
  assert.match(hero, /Registra la tua azienda/);
  assert.match(hero, /Crea una distinta gratis/);
  assert.match(hero, /source=home&surface=hero#calcolatore-pesi/);
  assert.match(hero, /Strumenti pubblici senza account/);
  assert.doesNotMatch(home, /bg-\[#438d7a\]/);
});

test("UXF4 keeps a focused homepage value path and existing public sections", () => {
  assert.match(hero, /Super Intelligence Ready/);
  assert.match(home, /Prima utilità, poi prodotto/);
  assert.match(home, /id="aziende"/);
  assert.match(home, /<PublicNetworkRoleExplorer \/>/);
  assert.doesNotMatch(home, /Trust by design/);
  assert.doesNotMatch(home, /rounded-\[24px\].*companyTypes/s);
});

test("UXF4 keeps public utility, company lookup and private Network boundaries", () => {
  assert.match(home, /<DeferredPublicCompanyLookup \/>/);
  assert.match(home, /La ricerca pubblica serve solo a riconoscere/);
  assert.match(network, /Privato · Premium/);
  for (const type of ["Produttori", "Commercianti", "Terzisti", "Utilizzatori"]) {
    assert.match(network, new RegExp(type));
  }
  assert.doesNotMatch(home, /href="\/network"/);
});
