import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const legal = fs.readFileSync(new URL("../lib/legal.ts", import.meta.url), "utf8");
const privacy = fs.readFileSync(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
const cookies = fs.readFileSync(new URL("../app/cookies/page.tsx", import.meta.url), "utf8");
const terms = fs.readFileSync(new URL("../app/terms/page.tsx", import.meta.url), "utf8");
const legalPage = fs.readFileSync(new URL("../app/legal/page.tsx", import.meta.url), "utf8");
const root = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const school = fs.readFileSync(new URL("../app/(public)/knowledge/layout.tsx", import.meta.url), "utf8");
const consent = fs.readFileSync(new URL("../components/google-analytics-consent.tsx", import.meta.url), "utf8");
const footer = fs.readFileSync(new URL("../components/public-legal-footer.tsx", import.meta.url), "utf8");
const env = fs.readFileSync(new URL("../.env.example", import.meta.url), "utf8");

test("LR1.1 legal identity is environment-driven and incomplete identities are noindex", () => {
  assert.match(legal, /NEXT_PUBLIC_LEGAL_CONTROLLER_NAME/);
  assert.match(legal, /NEXT_PUBLIC_LEGAL_CONTROLLER_ADDRESS/);
  assert.match(legal, /NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL/);
  assert.match(legal, /NEXT_PUBLIC_LEGAL_VAT_ID/);
  assert.match(legal, /NEXT_PUBLIC_LEGAL_REGISTRY_ID/);
  assert.match(legal, /identity\.controllerName && identity\.address && identity\.privacyEmail/);
  assert.match(legal, /index: false, follow: true, nocache: true/);
  assert.match(env, /NEXT_PUBLIC_LEGAL_CONTROLLER_NAME=/);
  assert.match(env, /NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL=/);
});

test("LR1.1 publishes the four minimum public legal surfaces", () => {
  assert.match(privacy, /Privacy Policy/);
  assert.match(cookies, /Cookie & Tracking Policy/);
  assert.match(terms, /Termini d’uso/);
  assert.match(legalPage, /Informazioni legali/);
  for (const source of [privacy, cookies, terms, legalPage]) {
    assert.match(source, /legalRobots\(\)/);
    assert.match(source, /LegalPageShell/);
  }
});

test("LR1.1 privacy policy describes current core data flows without inventing controller data", () => {
  assert.match(privacy, /registrazione, autenticazione, claim/);
  assert.match(privacy, /Google Analytics/);
  assert.match(privacy, /art\. 14/i);
  assert.match(privacy, /accesso, rettifica, cancellazione, limitazione/);
  assert.match(privacy, /Supabase, Vercel, Railway/);
  assert.match(privacy, /retention matrix/i);
  assert.doesNotMatch(privacy + legalPage, /Claudiu|Timaru/i);
});

test("LR1.1 cookie policy documents local retention and consent-gated GA4", () => {
  assert.match(cookies, /local storage/i);
  assert.match(cookies, /ultimi calcoli, preferiti/);
  assert.match(cookies, /Google Analytics 4/);
  assert.match(cookies, /_ga/);
  assert.match(cookies, /non viene caricato prima del consenso/i);
  assert.match(cookies, /Scorrere la pagina/);
  assert.match(cookies, /linguetta “Privacy”/);
});

test("LR1.1 terms contain technical calculator and company-profile disclaimers", () => {
  assert.match(terms, /non sostituiscono norme ufficiali/i);
  assert.match(terms, /Valori reali di fornitura possono differire/i);
  assert.match(terms, /non costituisce certificazione/i);
  assert.match(terms, /scraping non autorizzato/i);
  assert.match(terms, /condizioni SaaS B2B LR8/i);
});

test("LR1.1 legal links are permanently reachable across public surfaces", () => {
  assert.match(root, /<PublicLegalFooter \/>/);
  for (const href of ["/privacy", "/cookies", "/terms", "/legal"]) {
    assert.match(home, new RegExp(`href="${href}"`));
    assert.match(school, new RegExp(`href="${href}"`));
    assert.match(footer, new RegExp(`href="${href}"`));
  }
  assert.match(footer, /"\/login"/);
  assert.match(footer, /"\/register"/);
  assert.match(footer, /"\/azienda"/);
});

test("LR1.1 analytics first layer links directly to privacy and cookie information", () => {
  assert.match(consent, /href="\/privacy"/);
  assert.match(consent, /href="\/cookies"/);
  assert.match(consent, /Privacy/);
  assert.match(consent, /Cookie Policy/);
  assert.match(consent, /Accetta necessari/);
  assert.match(consent, /Accetta/);
});
