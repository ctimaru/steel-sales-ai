// COMM-CYCLE2.C: customer-only email content, previews, and security contracts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildCustomerOfferEmail, customerOfferEmailReady, defaultCustomerOfferSubject,
  validCustomerEmailRecipient,
} from "../lib/comm-cycle2c-email.ts";

const read=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const base={
  seller:"Tubificio Demo",client:"Azienda Cliente",revision:2,
  validUntil:"2026-12-31",delivery:"EXW Milano",payment:"30 gg DFFM",
  lines:[{
    description:"EN 10219 S355 Ø88,9 <script>alert(1)</script>",
    quantity:10,quantityUnit:"t",rate:"1250",unit:"EUR/t",weight:"",
  },{
    description:"Profilato 40x40",quantity:100,quantityUnit:"m",
    rate:"27",unit:"EUR/m",weight:"",
  }],
};

test("every customer line, rate, quantity and terms appears in HTML and text",()=>{
  const email=buildCustomerOfferEmail(base,defaultCustomerOfferSubject(base),"Gentile cliente,\nproposta aggiornata.");
  assert.match(email.subject,/v2/);
  for(const word of ["1.250,00","27,00","EXW Milano","30 gg DFFM","31\/12\/2026",
    "Gentile cliente","Tubificio Demo","Azienda Cliente"]) {
    assert.ok(email.html.includes(word),"html missing "+word);
    assert.ok(email.text.includes(word),"text missing "+word);
  }
  assert.match(email.html,/Totale indicativo: € 15.200,00/);
  assert.doesNotMatch(email.html,/<script>/);
  assert.match(email.html,/&lt;script&gt;/);
  assert.doesNotMatch(email.html,/fornitore|target di acquisto|internal_target/i);
});

test("unknown conversion never fabricates a total",()=>{
  const offer={...base,lines:[{...base.lines[0],quantity:12,quantityUnit:"pezzi",weight:""}]};
  const email=buildCustomerOfferEmail(offer,"Oggetto","Messaggio");
  assert.match(email.text,/Totale complessivo da verificare/);
  assert.match(email.html,/Totale complessivo non disponibile/);
});

test("recipient validation and incomplete quote are fail-closed",()=>{
  assert.equal(validCustomerEmailRecipient("cliente@azienda.it"),true);
  assert.equal(validCustomerEmailRecipient("x\r\nBcc:evil@spam.it"),false);
  assert.equal(validCustomerEmailRecipient("nonesiste"),false);
  assert.equal(customerOfferEmailReady(base),true);
  assert.equal(customerOfferEmailReady({...base,payment:""}),false);
  assert.equal(customerOfferEmailReady({...base,lines:[]}),false);
  assert.equal(customerOfferEmailReady({...base,lines:[{...base.lines[0],rate:""}]}),false);
});

test("send is an explicitly confirmed server action; never silently repeat or generate a PDF",()=>{
  const migration=read("../../../supabase/migrations/20261119220000_comm_cycle2c_email_only.sql");
  const action=read("../app/(italian)/(workspace)/commercial/cycle2c-actions.ts");
  const ui=read("../components/commercial-customer-offer-email.tsx");
  const panel=read("../components/commercial-customer-offer-panel.tsx");
  const gate=read("../../../.github/workflows/p0-required-gate.yml");
  const hp13=read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");
  assert.match(migration,/comm_cycle2c_reserve_email/);
  assert.match(migration,/comm_cycle2c_complete_email/);
  assert.match(migration,/comm_cycle2c_freeze_offer/);
  assert.match(migration,/comm_cycle1_apply/);
  assert.match(action,/verified_recipient/);
  assert.match(action,/canWriteWorkspace/);
  assert.match(action,/officeWriteDenied/);
  assert.match(action,/RESEND_API_KEY/);
  assert.match(action,/Idempotency-Key/);
  assert.match(action,/response\.status < 500/);
  assert.match(action,/no-store/);
  assert.match(ui,/Anteprima email/);
  assert.match(ui,/Conferma e invia email/);
  assert.match(ui,/sandbox=""/);
  assert.match(panel,/comm_offer_email_dispatches/);
  assert.match(gate,/comm_cycle2c_email_dispatch\.sql/);
  assert.match(hp13,/comm_cycle2c_reserve_email/);
  assert.match(hp13,/comm_cycle2c_complete_email/);
  assert.doesNotMatch(migration,/CREATE TABLE.*trattativa/i);
  assert.doesNotMatch(action,/\.pdf\b|application\/pdf|sendCustomerOfferEmail\(\)/i);
});
