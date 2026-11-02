import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const reach=read("../lib/network-rfq-reachability.ts");
const actions=read("../app/(italian)/(workspace)/marketplace/rfq-hub/actions.ts");
const legal=read("../lib/legal.ts");

test("RFQ-MAIL2 email channel is off until the controller identity is configured",()=>{
  assert.match(reach,/export function emailChannelEnabled\(\): boolean \{\n  return legalIdentityConfigured\(\);/);
  assert.match(reach,/entry\.channel === "email" && !emailChannelEnabled\(\) \? "none" : entry\.channel/);
  assert.match(legal,/Boolean\(identity\.controllerName && identity\.address && identity\.privacyEmail\)/);
});

test("RFQ-MAIL2 launch refuses unregistered Network recipients without legal identity",()=>{
  assert.match(actions,/supplier_network_contact_id,supplier_organization_id"\)/);
  assert.match(actions,/!legalIdentityConfigured\(\) &&\n    context\.suppliers\.some\(\n      \(supplier\) => supplier\.supplier_network_contact_id && !supplier\.supplier_organization_id,/);
  assert.match(actions,/L'invio ad aziende non registrate non è ancora attivo/);
  // The check runs before the dispatch RPC: nothing is reserved or sent.
  assert.ok(actions.indexOf("L'invio ad aziende non registrate")<actions.indexOf('rpc("rfqh3_launch_campaign"'));
});
