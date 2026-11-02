import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const actions=read("../app/(italian)/(workspace)/marketplace/rfq-hub/network-handoff-actions.ts");
const receiver=read("../components/rfq-network-supplier-receiver.tsx");
const hub=read("../app/(italian)/(workspace)/marketplace/rfq-hub/page.tsx");
const handoff=read("../lib/network-rfq-supplier-handoff.ts");

test("NET-AUDIT1.3b server actions trust nothing from the browser",()=>{
  assert.match(actions,/^"use server";/);
  assert.match(actions,/unique\.length !== ids\.length \|\| unique\.length > NETWORK_RFQ_HANDOFF_MAX_SUPPLIERS/);
  assert.match(actions,/\.eq\("publication_status", "published"\)\.is\("archived_at", null\)/);
  assert.match(actions,/getNetworkRecipientReadiness\(organizationId, ids\)/);
  assert.match(actions,/selectable: Boolean\(name\) && isRfqSelectable\(status\)/);
  assert.match(actions,/\.in\("status", \[\.\.\.OPEN_STATUSES\]\)/);
  assert.match(actions,/const OPEN_STATUSES = \["draft", "ready"\] as const;/);
});

test("NET-AUDIT1.3b apply revalidates at click time and uses the existing add path only",()=>{
  assert.match(actions,/if \(!canWriteWorkspace\(context\.role\)\)/);
  assert.match(actions,/\/\/ Revalidate at click time/);
  assert.match(actions,/identitySource: "network_company"/);
  assert.match(actions,/supplierNetworkCompanyId: supplier\.id/);
  assert.match(actions,/await addSupplierToBuyerRfq\(/);
  assert.doesNotMatch(actions,/launchBuyerRfq|sendRfqh3Email|rpc\("rfqh3|service_role/);
});

test("NET-AUDIT1.3b receiver: explicit click, honest states, kept until used or dismissed",()=>{
  assert.match(receiver,/parseNetworkRfqHandoff\(raw\)/);
  assert.match(receiver,/previewNetworkSupplierHandoff\(parsed\.companyIds\)/);
  assert.match(receiver,/onClick=\{apply\}/);
  assert.match(receiver,/Nessun invio è partito/);
  assert.match(receiver,/la selezione resta disponibile/);
  assert.match(receiver,/window\.sessionStorage\.removeItem\(key\)/);
  assert.match(receiver,/Annulla selezione/);
  assert.match(receiver,/id="network-suppliers"/);
  assert.match(hub,/<RfqNetworkSupplierReceiver userId=\{context\.userId\} organizationId=\{organizationId\} \/>/);
});

test("NET-AUDIT1.3b selection is on by default with an emergency switch",()=>{
  assert.match(handoff,/NETWORK_RFQ_RECEIVER_PATH="\/rfq-hub\?from=network#network-suppliers"/);
  assert.match(handoff,/NEXT_PUBLIC_NETAUDIT1_RFQ_SELECTION!=="false"/);
});
