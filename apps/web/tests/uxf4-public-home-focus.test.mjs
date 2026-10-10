import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const network = fs.readFileSync(
  new URL("../components/public-network-role-explorer.tsx", import.meta.url),
  "utf8",
);

test("UXF4 preserves public discovery links in both desktop and mobile header", () => {
  assert.match(home, /aria-label="Navigazione pubblica"/);
  assert.match(home, /aria-label="Navigazione pubblica mobile"/);
  assert.match(home, /surface=header#calcolatore-pesi/);
  assert.match(home, />\s*Calcolo pesi\s*</);
  assert.match(home, /href="\/distinta"/);
  assert.match(home, /href="\/azienda"/);
  assert.doesNotMatch(home, />\s*Calcolatore\s*</);
});

test("UXF4 prioritizes registration while keeping a no-account utility CTA", () => {
  assert.match(home, /href="\/register" className="platform-primary inline-flex min-h-12/);
  assert.match(home, /Registra la tua azienda/);
  assert.match(home, /Crea distinta gratis/);
  assert.match(home, /href="\/knowledge\/tubes\?source=home&surface=hero#calcolatore-pesi"/);
  assert.match(home, /Utile anche senza account/);
  assert.doesNotMatch(home, /bg-\[#438d7a\]/);
});

test("UXF4 keeps a focused homepage value path and existing public sections", () => {
  assert.match(home, /Super Intelligence Ready/);
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
