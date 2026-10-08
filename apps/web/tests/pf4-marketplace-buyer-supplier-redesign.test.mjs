import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const home = read("../app/(workspace)/marketplace/page.tsx");
const shell = read("../components/app-shell.tsx");
const buyerRequest = read("../app/(workspace)/marketplace/[id]/page.tsx");
const opportunity = read("../app/(workspace)/marketplace/opportunities/[id]/page.tsx");
const inbox = read("../app/(workspace)/marketplace/inbox/page.tsx");
const requests = read("../app/(workspace)/marketplace/requests/page.tsx");
const responses = read("../app/(workspace)/marketplace/responses/page.tsx");
const responseDetail = read("../app/(workspace)/marketplace/responses/[id]/page.tsx");
const suppliers = read("../app/(workspace)/marketplace/suppliers/page.tsx");
const supplierDetail = read("../app/(workspace)/marketplace/suppliers/[profileId]/page.tsx");
const rfqDetail = read("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");

test("PF4 makes buyer and supplier jobs explicit at Marketplace entry", () => {
  assert.match(home, /Compra o vendi, in un unico spazio/);
  assert.match(home, /Chiedi offerte a più fornitori/);
  assert.match(home, /Trova richieste a cui puoi rispondere/);
  assert.match(home, /Apri RFQ Hub/);
  assert.match(home, /Opportunità per te/);
});

test("PF4 reduces contextual Marketplace navigation to four user jobs", () => {
  const marketplaceNav = shell.slice(shell.indexOf("const marketplaceNav:"), shell.indexOf("const knowledgeNav:"));
  for (const label of ["Opportunità", "Le mie pubblicazioni", "Risposte Marketplace", "Notifiche"]) {
    assert.match(marketplaceNav, new RegExp(`label: "${label}"`));
  }
  for (const oldLabel of [
    "Inbox acquisti",
    "Supplier",
    "Per te",
    "Le mie ricerche",
    "Risposte ricevute",
    "Nuova ricerca",
  ]) {
    assert.doesNotMatch(marketplaceNav, new RegExp(`label: "${oldLabel}"`));
  }
});

test("PF4 removes internal roadmap language from customer-facing Marketplace pages", () => {
  const pages = [
    home,
    buyerRequest,
    opportunity,
    inbox,
    requests,
    responses,
    responseDetail,
    suppliers,
    supplierDetail,
    rfqDetail,
  ];

  for (const page of pages) {
    assert.doesNotMatch(page, /P5\./);
    assert.doesNotMatch(page, /eyebrow="RFQH\d/);
    assert.doesNotMatch(page, />RFQH\d</);
    assert.doesNotMatch(page, /Free teaser|Demand Board|Privacy boundary/i);
  }
});

test("PF4 keeps governed buyer and supplier boundaries while using business language", () => {
  assert.match(home, /Commercial Memory e Marketplace restano separati/);
  assert.match(opportunity, /livello di accesso richiesto/);
  assert.match(opportunity, /diritto di risposta viene verificato separatamente/);
  assert.match(requests, /regole di privacy e accesso/);
  assert.match(responses, /fornitore abilitato/);
  assert.match(inbox, /non esegue automaticamente invii, solleciti, assegnazioni o emissioni PO/);
});
