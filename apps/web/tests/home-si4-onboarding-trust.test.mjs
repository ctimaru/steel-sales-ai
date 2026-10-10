import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const home = read("../app/page.tsx");
const trust = read("../components/public-registration-trust.tsx");
const network = read("../components/public-network-role-explorer.tsx");
const registration = read("../app/register/page.tsx");
const journey = read("../components/registration-journey.tsx");
const lookup = read("../components/public-company-lookup.tsx");
const gate = read("../components/network-access-gate.tsx");

test("HOME-SI4 keeps public tools available without registration", () => {
  assert.match(home, /Strumenti pubblici · senza account/);
  assert.match(home, /Prima utilità, poi prodotto/);
  assert.match(home, /Calcola, consulta o prepara una distinta/);
  for (const route of ["/distinta", "/knowledge/norme", "/knowledge/gradi"]) {
    assert.ok(home.includes('href: "' + route + '"') || home.includes('href="' + route + '"'));
  }
  assert.match(home, /source=home&surface=school_section#calcolatore-pesi/);
  assert.match(home, /<DeferredPublicCompanyLookup \/>/);
});

test("HOME-SI4 keeps public company identity and premium Network distinct", () => {
  assert.match(network, /Privato · Premium/);
  assert.match(network, /Identità e Network sono distinti/);
  assert.match(network, /abilitazione Network separata/);
  assert.match(network, /href="\/azienda"/);
  assert.match(home, /Non trovi la tua azienda\? Registrala/);
  assert.match(home, /La ricerca pubblica serve solo a riconoscere/);
  assert.match(gate, /Non serve acquistare il Network per rivendicare/);
  assert.doesNotMatch(home + network + trust, /href="\/network"|href="\/rfq-hub"|href="\/platform"/);
});

test("HOME-SI4 describes the implemented registration journey without fake automatic activation", () => {
  assert.match(home, /<PublicRegistrationTrust \/>/);
  assert.match(trust, /id="registrazione"/);
  assert.match(trust, /aria-labelledby="home-registration-title"/);
  for (const label of ["Cerca la tua azienda", "Verifica l’account", "Completa i dati", "Attendi la revisione"]) {
    assert.ok(trust.includes(label));
  }
  assert.match(registration, /<RegistrationJourney current=\{1\} compact \/>/);
  assert.match(journey, /Crea e verifica l’accesso/);
  assert.match(journey, /Controlliamo la richiesta/);
  assert.match(journey, /Apriamo il workspace/);
  assert.match(registration, /<PublicCompanyLookup/);
  assert.match(lookup, /\/register\?claim_ref=/);
  assert.match(trust, /non abilita automaticamente/);
  assert.doesNotMatch(trust, /approvazione immediata|accesso istantaneo|gratis per sempre|certificat[oa] ISO|già \d+ aziende/i);
});

test("HOME-SI4 makes trust and policy links actionable with lightweight, static UI", () => {
  assert.match(trust, /href="\/register"/);
  assert.match(trust, /href="\/login"/);
  assert.match(trust, /href="\/company-data"/);
  assert.match(trust, /href="\/privacy"/);
  assert.match(home, /href="\/company-data"/);
  assert.match(home, /<PublicNetworkRoleExplorer \/>[\s\S]*<PublicIntelligencePillars \/>[\s\S]*<DeferredPublicCompanyLookup \/>[\s\S]*<PublicRegistrationTrust \/>/);
  assert.match(home, /export const dynamic = "force-static"/);
  for (const part of [home, network, trust]) {
    assert.doesNotMatch(part, /"use client"|useEffect|useState|createClient|fetch\s*\(|cookies\s*\(|<video|<iframe/);
  }
  assert.match(trust, /sm:grid-cols-2 lg:grid-cols-4/);
  assert.match(trust, /min-h-11/);
});
