import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const load=async path=>{
  const source=read(path).replace(/^import .*;$/gm,"");
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
};
globalThis.process??={env:{}};
const handoff=await load("../lib/network-rfq-supplier-handoff.ts");
const ui=read("../components/network-compact-experience.tsx");
const bar=read("../components/network-rfq-selection-bar.tsx");
const listing=read("../lib/network-compact-directory.ts");
const A="11111111-1111-4111-8111-111111111111",B="22222222-2222-4222-8222-222222222222";
const ORG="33333333-3333-4333-8333-333333333333",USER="44444444-4444-4444-8444-444444444444";

test("NET-AUDIT1.3 handoff round-trip: ids only, deduplicated, summary sanitized",()=>{
  const now=1_800_000_000_000;
  const raw=handoff.serializeNetworkRfqHandoff([A,B,A],"EN 10219 · S355<script>",now);
  const parsed=handoff.parseNetworkRfqHandoff(raw,now+1000);
  assert.deepEqual(parsed,{version:1,createdAt:now,source:"network",companyIds:[A,B],specSummary:"EN 10219 · S355script"});
  assert.equal(handoff.networkRfqHandoffKey(USER,ORG),"smart-steel-sales:netaudit1:rfq-suppliers:"+ORG+":"+USER);
});

test("NET-AUDIT1.3 handoff rejects stale, oversized, foreign or tampered payloads",()=>{
  const now=1_800_000_000_000;
  const raw=handoff.serializeNetworkRfqHandoff([A],undefined,now);
  assert.equal(handoff.parseNetworkRfqHandoff(raw,now+15*60*1000+1),null,"expired");
  assert.equal(handoff.serializeNetworkRfqHandoff(["not-a-uuid"],undefined,now),null);
  assert.equal(handoff.serializeNetworkRfqHandoff([],undefined,now),null);
  const many=Array.from({length:21},(_,i)=>"aaaaaaaa-aaaa-4aaa-8aaa-"+String(i).padStart(12,"0"));
  assert.equal(handoff.serializeNetworkRfqHandoff(many,undefined,now),null,"max 20");
  const extra=JSON.stringify({...JSON.parse(raw),email:"x@example.test"});
  assert.equal(handoff.parseNetworkRfqHandoff(extra,now),null,"unknown keys rejected");
  assert.equal(handoff.parseNetworkRfqHandoff('{"version":1}',now),null);
  assert.throws(()=>handoff.networkRfqHandoffKey("bad",ORG));
});

test("NET-AUDIT1.3 only available or connected companies are selectable",()=>{
  assert.equal(handoff.isRfqSelectable("available"),true);
  assert.equal(handoff.isRfqSelectable("connected"),true);
  assert.equal(handoff.isRfqSelectable("pending"),false);
  assert.equal(handoff.isRfqSelectable("unavailable"),false);
  assert.equal(handoff.isRfqSelectable(undefined),false);
});

test("NET-AUDIT1.3 list: readiness badges, claim link, selection behind a flag, Pro only",()=>{
  assert.match(listing,/getNetworkRecipientReadiness\(organizationId,ids\)/);
  // NET-CONTACT1: selection also accepts email-reachable companies (isRfqReachable).
  assert.match(listing,/\.catch\(\(\)=>undefined\)/);
  // NET-UX LOT1: one Contatto column; "Connetti" is the only row action, the claim lives on the profile.
  assert.match(ui,/if\(status==="available"\)return <Link href=\{"\/network\/"\+company\.id\+"\/connect"\}/);
  assert.match(ui,/✓ Connessa/);
  assert.match(ui,/Richiesta inviata/);
  assert.doesNotMatch(ui,/Rappresenti questa azienda\?|>Censita</);
  assert.match(ui,/const rfqSelection=networkRfqSelectionEnabled\(\);/);
  assert.match(ui,/selectable=\{rfqSelection&&accessMode==="pro"&&isRfqReachable\(/);
  assert.match(ui,/form="network-rfq-selection" name="supplier"/);
  // NET-AUDIT1.3b: on by default now that the receiver exists; "false" is the emergency switch.
  assert.match(read("../lib/network-rfq-supplier-handoff.ts"),/NEXT_PUBLIC_NETAUDIT1_RFQ_SELECTION!=="false"/);
});

test("NET-AUDIT1.3 selection bar writes the handoff and never sends anything",()=>{
  assert.match(bar,/"use client"/);
  assert.match(bar,/window\.sessionStorage\.setItem\(networkRfqHandoffKey\(userId,organizationId\),value\)/);
  assert.match(bar,/router\.push\(NETWORK_RFQ_RECEIVER_PATH\)/);
  assert.match(bar,/Nessuna richiesta parte automaticamente/);
  assert.doesNotMatch(bar,/fetch\(|rpc\(|addSupplier/);
});

test("NET-AUDIT1.3 selection reconciles with the rows on screen (Codex review #1078)",()=>{
  assert.match(bar,/new MutationObserver\(read\)/);
  assert.match(bar,/observer\.observe\(document\.body,\{childList:true,subtree:true\}\)/);
  assert.match(bar,/observer\.disconnect\(\)/);
  assert.match(bar,/const visible=checkedSuppliers\(\);/);
  assert.match(bar,/serializeNetworkRfqHandoff\(visible,specSummary\)/);
  assert.match(bar,/La selezione vale per i risultati mostrati/);
});
