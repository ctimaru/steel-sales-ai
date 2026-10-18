import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const connect=read("../app/(italian)/(workspace)/network/[id]/connect/page.tsx");
const readiness=read("../components/network-ready-connections.tsx");

test("NET-LAUNCH5C: connection requires a reason and a meaningful private message",()=>{
 assert.match(connect,/name="purpose"/);
 for(const purpose of ["offer_products_services","request_products_services","collaboration"])
  assert.ok(connect.includes(purpose));
 assert.match(connect,/name="message" required minLength=\{30\} maxLength=\{2000\}/);
 assert.match(connect,/action=\{submitNetworkConnection\}/);
});
test("NET-LAUNCH5C: no calls to provisional, unreachable or duplicate recipients",()=>{
 assert.match(connect,/discovery_status==="unconfirmed"\?"unavailable"/);
 assert.match(connect,/status!=="available"/);
 assert.match(connect,/status==="pending"/);
 assert.match(connect,/status==="connected"/);
 assert.match(connect,/getNetworkRecipientReadiness/);
 assert.match(readiness,/statuses\.get\(x\.id\)==="available"/);
 assert.match(readiness,/status==="available"&&canAct/);
});
test("NET-LAUNCH5C: no fabricated connection and private response route",()=>{
 assert.match(connect,/non crea automaticamente una relazione/);
 assert.match(readiness,/network\/connections\?box=received/);
 assert.doesNotMatch(connect,/autoAccept|mockConnect|fakeRequest/);
});
