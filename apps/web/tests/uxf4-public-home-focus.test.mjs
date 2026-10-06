import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const network = fs.readFileSync(
  new URL("../components/public-network-role-explorer.tsx", import.meta.url),
  "utf8",
);

test("UXF4 keeps public navigation neutral and renames calculator entry", () => {
  assert.match(home, />\s*Calcolo pesi\s*</);
  assert.doesNotMatch(home, />\s*Calcolatore\s*</);
  assert.match(
    home,
    /href="\/knowledge\/tubes\?source=home&surface=header#calcolatore-pesi"[\s\S]*className="rounded-lg px-3 py-2 text-sm font-semibold text-\[#52615b\]/,
  );
  assert.doesNotMatch(
    home,
    /surface=header#calcolatore-pesi"[\s\S]{0,180}bg-\[#edf5f2\]/,
  );
});

test("UXF4 uses an accessible brand-colored weight CTA instead of a white hero button", () => {
  assert.match(home, /surface=hero#calcolatore-pesi/);
  assert.match(home, /public-primary-cta/);
  assert.doesNotMatch(home, /bg-\[#438d7a\]/);
  assert.doesNotMatch(
    home,
    /surface=hero#calcolatore-pesi"[\s\S]{0,220}bg-white/,
  );
});

test("UXF4 reduces the homepage to four focused content stages", () => {
  assert.match(home, /Smart Steel Sales · Utile anche senza account/);
  assert.match(home, /Prima utilità, poi prodotto/);
  assert.match(home, /id="aziende"/);
  assert.match(home, /<PublicNetworkRoleExplorer \/>/);
  assert.doesNotMatch(home, /Trust by design/);
  assert.doesNotMatch(home, /Ragione sociale o Partita IVA\."\]/);
  assert.doesNotMatch(home, /rounded-\[24px\].*companyTypes/s);
});

test("UXF4 keeps public utility, company lookup and private Network boundaries", () => {
  assert.match(home, /<PublicCompanyLookup \/>/);
  assert.match(home, /La ricerca pubblica serve solo a riconoscere/);
  assert.match(network, /Privato · Premium/);
  for (const type of ["Produttori", "Commercianti", "Terzisti", "Utilizzatori"]) {
    assert.match(network, new RegExp(type));
  }
  assert.doesNotMatch(home, /href="\/network"/);
});
