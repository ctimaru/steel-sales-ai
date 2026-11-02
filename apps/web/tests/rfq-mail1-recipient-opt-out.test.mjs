import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const dispatchSource=read("../lib/rfqh3-dispatch.ts");
const actions=read("../app/(italian)/(workspace)/marketplace/rfq-hub/actions.ts");
const page=read("../app/(italian)/(public)/rfq/unsubscribe/[token]/page.tsx");
const route=read("../app/api/rfq/unsubscribe/[token]/route.ts");
const lib=read("../lib/rfq-opt-out.ts");
const sql=read("../../../supabase/migrations/20261102150000_rfqmail1_recipient_opt_out.sql");
const gate=read("../../../.github/workflows/p0-required-gate.yml");

const stub='import { createHash, createHmac } from "node:crypto";\n'+
  'function legalIdentity(){return {controllerName:"Esempio S.r.l.",address:"Via Roma 1, Milano",privacyEmail:"privacy@example.test",vatId:"01234567890",registryId:null}}\n'+
  'function legalIdentityConfigured(i){return Boolean(i.controllerName&&i.address&&i.privacyEmail)}\n'+
  'function absoluteUrl(p){return "https://www.smartsteelsales.com"+p}\n';
const js=ts.transpileModule(dispatchSource.replace(/^import .*;$/gm,""),
  {compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const mod=await import("data:text/javascript;base64,"+Buffer.from(stub+js).toString("base64"));

test("RFQ-MAIL1 invitation and reminder carry opt-out, privacy and legal identity",()=>{
  const links=mod.buildRfqh3RecipientLinks("tok_123");
  assert.equal(links.optOutUrl,"https://www.smartsteelsales.com/rfq/unsubscribe/tok_123");
  assert.equal(links.headers["List-Unsubscribe"],"<https://www.smartsteelsales.com/api/rfq/unsubscribe/tok_123>");
  assert.equal(links.headers["List-Unsubscribe-Post"],"List-Unsubscribe=One-Click");
  const base={buyerOrganizationName:"Buyer S.r.l.",supplierName:null,title:"T",dueAt:null,inviteUrl:links.inviteUrl,optOutUrl:links.optOutUrl};
  for(const email of [mod.buildRfqh3Email({...base,buyerMessage:null,lines:[]}),mod.buildRfqh3ReminderEmail({...base,reminderSequence:1})]){
    assert.match(email.html,/Annulla l'iscrizione/);
    assert.match(email.html,/rfq\/unsubscribe\/tok_123/);
    assert.match(email.html,/\/privacy/);
    assert.match(email.html,/Esempio S\.r\.l\. · Via Roma 1, Milano · P\.IVA 01234567890/);
    assert.match(email.text,/Annulla l'iscrizione: https:\/\/www\.smartsteelsales\.com\/rfq\/unsubscribe\/tok_123/);
    assert.match(email.text,/Puoi rispondere senza registrarti/);
  }
});

test("RFQ-MAIL1 every send path passes the one-click headers",()=>{
  assert.equal((actions.match(/headers: (links|retryLinks|reminderLinks)\.headers,/g)||[]).length,3);
  assert.match(actions,/headers: input\.headers,/);
  assert.doesNotMatch(actions,/buildRfqh3InviteUrl\(/);
});

test("RFQ-MAIL1 opt-out needs a click on the page and POST on the endpoint",()=>{
  assert.match(page,/<form action=\{confirmRfqOptOut\}>/);
  assert.match(page,/robots: \{ index: false, follow: false \}/);
  assert.match(route,/export async function POST/);
  assert.match(route,/status: 405/);
  assert.match(lib,/createHash\("sha256"\)\.update\(value\)\.digest\("hex"\)/);
  assert.match(lib,/rpc\("rfqmail1_opt_out"/);
});

test("RFQ-MAIL1 SQL: opt_out suppression, invoker wrapper, reachability excludes suppressed",()=>{
  assert.match(sql,/check \(reason in \('hard_bounce','complaint','opt_out'\)\)/);
  assert.match(sql,/on conflict \(email_normalized\) do nothing/);
  assert.match(sql,/returns jsonb language sql volatile security invoker set search_path='' as \$\$\n  select rfqh_secure\.rfqmail1_opt_out_impl/);
  assert.match(sql,/where x\.email_normalized=b\.email/);
  assert.match(gate,/rfqmail1_recipient_opt_out\.sql/);
});
