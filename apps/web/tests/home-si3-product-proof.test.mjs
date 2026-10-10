import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const home = read("../app/page.tsx");
const showcase = read("../components/public-intelligence-showcase.tsx");
const routes = read("../lib/routes.ts");
const rfqPage = read("../app/(workspace)/marketplace/rfq-hub/page.tsx");
const network = read("../app/(workspace)/network/page.tsx");
const school = read("../app/(public)/knowledge/page.tsx");

test("HOME-SI3 grounds the preview in genuine RFQ Hub labels, without tenant data", () => {
  assert.match(home, /<PublicProductPreview \/>/);
  assert.match(showcase, /export function PublicProductPreview/);
  assert.match(showcase, /Nuova distinta/);
  for (const label of ["Distinte salvate", "Campagne RFQ", "Offerte ricevute", "Purchase Order"]) {
    assert.ok(showcase.includes(label), "Missing grounded preview label " + label);
    assert.ok(rfqPage.includes(label), "Not present in actual RFQ Hub " + label);
  }
  assert.match(showcase, /non uno screenshot né dati reali/);
  assert.match(showcase, /senza dati aziendali/);
  assert.match(showcase, /L’AI assiste, la decisione resta alle persone/);
  assert.doesNotMatch(showcase, /€\/t 6|Saving \d|percentuale|100% automatico/i);
});

test("HOME-SI3 creates three clear intelligence pillars with honest access boundaries", () => {
  assert.match(home, /<PublicIntelligencePillars \/>/);
  assert.match(showcase, /id="intelligence"/);
  for (const label of ["Procurement Intelligence", "Network Intelligence", "Steel Knowledge"]) {
    assert.match(showcase, new RegExp(label));
  }
  assert.match(showcase, /validazione pilota/);
  assert.match(showcase, /registrate e abilitate/);
  assert.match(showcase, /anche senza login/);
  assert.match(network, /getNetworkAccessState/);
  assert.match(routes, /createDistinta: "\/rfq-hub\/distinta"/);
  assert.match(school, /Strumento principale/);
});

test("HOME-SI3 links only to real public routes or safe registration, never a private directory", () => {
  assert.match(showcase, /href="\/distinta"/);
  assert.match(showcase, /href="\/register"/);
  assert.match(showcase, /href="\/knowledge"/);
  assert.match(showcase, /href="#network"/);
  assert.doesNotMatch(showcase, /href="\/network"|href="\/rfq-hub"|href="\/platform"/);
  assert.doesNotMatch(showcase, /<button|onClick=|<input/);
});

test("HOME-SI3 keeps the homepage static and the initial Network discoverable", () => {
  assert.match(home, /export const dynamic = "force-static"/);
  assert.match(home, /<PublicProductPreview \/>[\s\S]*<PublicNetworkRoleExplorer \/>[\s\S]*<PublicIntelligencePillars \/>[\s\S]*Prima utilità, poi prodotto/);
  for (const part of [home, showcase]) {
    assert.doesNotMatch(part, /"use client"|useEffect|useState|fetch\s*\(|createClient|cookies\s*\(|getUser\s*\(|next\/image|<Image|<video|<iframe/);
  }
  assert.match(showcase, /grid-cols-2/);
  assert.match(showcase, /md:grid-cols-3/);
  assert.match(showcase, /aria-labelledby="home-intelligence-title"/);
});
