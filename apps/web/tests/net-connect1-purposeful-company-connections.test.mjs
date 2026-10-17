import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");

const shell=read("../components/app-shell.tsx");
const pro=read("../app/(workspace)/network/page.tsx");
const profile=read("../app/(workspace)/network/[id]/page.tsx");
const free=read("../components/free-network-profile.tsx");
const compose=read("../app/(workspace)/network/[id]/connect/page.tsx");
const inbox=read("../app/(workspace)/network/connections/page.tsx");
const actions=read("../app/(workspace)/network/actions.ts");
const db=read("../../../supabase/migrations/20261017160000_netconnect1_purposeful_company_connections.sql");
const routes=read("../lib/routes.ts");

test("NET-CONNECT1: navigation is professional and has no social follow/save feeds",()=>{
 assert.match(shell,/label: "Esplora aziende"/);
 assert.match(shell,/label: "Connessioni"/);
 assert.doesNotMatch(shell,/label: "Salvate"|label: "Seguite"|label: "Attività"/);
 assert.match(shell,/networkEnabled && networkEntitled/);
 assert.match(shell,/networkFreeEnabled/);
 assert.match(routes,/connections: "\/network\/connections"/);
 assert.doesNotMatch(pro,/saveNetworkCompany|followNetworkCompany|unfollowNetworkCompany|removeSavedNetworkCompany/);
 assert.doesNotMatch(profile,/saveNetworkCompany|followNetworkCompany|unfollowNetworkCompany|removeSavedNetworkCompany/);
});

test("NET-CONNECT1: explicit purpose, 30+ character message and no empty invitations",()=>{
 for(const value of ["offer_products_services","request_products_services","collaboration"]){
  assert.ok(compose.includes('value:"'+value+'"'));
  assert.ok(db.includes("'"+value+"'"));
 }
 assert.match(compose,/type="radio" name="purpose" value=\{r.value\} required/);
 assert.match(compose,/name="message" required minLength=\{30\} maxLength=\{2000\}/);
 assert.match(actions,/export async function submitNetworkConnection/);
 assert.match(actions,/message.length<30\|\|message.length>2000/);
 assert.match(actions,/netconnect1_submit/);
 assert.match(db,/private\.p4_submit_inquiry_impl/);
 assert.match(db,/netconnect1_one_pending_pair/);
});

test("NET-CONNECT1: recipient must be real and reachable, no fake delivery for provisional",()=>{
 assert.match(compose,/getInquiryEligibility\(actor\.organizationId,id\)/);
 assert.match(compose,/!eligibility\.eligible/);
 assert.match(profile,/inquiryEligible && canInteract/);
 assert.match(profile,/Richiedi connessione/);
 assert.match(free,/eligibility\.eligible/);
 assert.match(free,/La connessione sulla piattaforma sarà disponibile/);
 assert.match(db,/private\.netux11_require_active_company/);
 assert.match(db,/private\.p4_submit_inquiry_impl/);
 assert.doesNotMatch(compose,/service_role|email\.send\(/);
});

test("NET-CONNECT1: status changes are real guarded decisions, never a social follow",()=>{
 for(const word of ["Accetta connessione","Rifiuta","Ritira richiesta"])assert.match(inbox,new RegExp(word));
 for(const d of ["accepted","declined","withdrawn"])assert.match(db,new RegExp("'"+d+"'"));
 assert.match(inbox,/item\.inquiry_status==="submitted"/);
 assert.match(inbox,/decideNetworkConnection/);
 assert.match(actions,/netconnect1_decide/);
 assert.match(db,/private\.p4_transition_inquiry_impl/);
 assert.match(db,/Only recipient may accept or decline/);
 assert.match(db,/Only sender may withdraw/);
});

test("NET-CONNECT1: old saved/followed source data not destructively dropped",()=>{
 assert.doesNotMatch(db,/drop table|truncate|delete from|alter table public\.network_saved/i);
 assert.match(pro,/Esplora aziende/);
 assert.match(shell,/networkNav, organizationRole/);
});
