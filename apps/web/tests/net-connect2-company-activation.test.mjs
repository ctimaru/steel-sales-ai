import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const activation=read("../components/network-activation-cta.tsx");
const provisional=read("../components/network-launch-discovery.tsx");
const freeProfile=read("../components/free-network-profile.tsx");
const freeList=read("../components/free-network-directory.tsx");
const proList=read("../app/(workspace)/network/page.tsx");
const proProfile=read("../app/(workspace)/network/[id]/page.tsx");
const signup=read("../app/(italian)/register/page.tsx");
const lookup=read("../components/public-company-lookup.tsx");
const claims=read("../app/(workspace)/network/[id]/claim/page.tsx");
const analytics=read("../lib/product-analytics-events.client.ts");

test("NET-CONNECT2: activation differentiates published company claim and unconfirmed registration",()=>{
 assert.match(activation,/mode==="published"/);
 assert.match(activation,/\/network\/".*\/claim"/);
 assert.match(activation,/\/register"/);
 assert.match(activation,/company=.+encodeURIComponent\(name\)/);
 assert.match(activation,/intentionally NOT passed as a claim_ref/);
 assert.match(activation,/non assegna automaticamente/);
 assert.match(activation,/network_activation_registration_click/);
 assert.match(analytics,/network_activation_registration_click/);
});

test("NET-CONNECT2: all discovery cards can offer voluntary company registration without fake delivery",()=>{
 assert.match(provisional,/<NetworkActivationCta mode="discovered"/);
 assert.match(provisional,/source="network_discoveries"/);
 assert.match(provisional,/Registrarsi non comporta la rivendicazione automatica/);
 assert.doesNotMatch(provisional,/submitNetworkConnection|netconnect1_submit/);
 assert.match(freeProfile,/provisional \?/);
 assert.match(freeProfile,/<NetworkActivationCta mode="discovered"/);
});

test("NET-CONNECT2: claim only from admin context; same guarded claim path in Free and Pro",()=>{
 assert.match(proList,/isWorkspaceAdmin=\{context\.role==="admin"\}/);
 assert.match(proList,/context\.role==="admin" && \["unclaimed","revoked"\]/);
 assert.match(proList,/mode="published"/);
 assert.match(proProfile,/isWorkspaceAdmin=\{context\.role==="admin"\}/g);
 assert.match(proProfile,/adminOrganizationId/);
 assert.match(proProfile,/<NetworkActivationCta mode="published"/);
 assert.match(freeList,/isWorkspaceAdmin && \["unclaimed","revoked"\]/);
 assert.match(freeProfile,/isWorkspaceAdmin && \["unclaimed","revoked"\]/);
 assert.match(claims,/requireWorkspaceAdmin/);
 assert.match(claims,/getCompanyClaimExperience/);
 assert.match(claims,/authority_confirmed/);
});

test("NET-CONNECT2: registration prefill is a hint, never a trusted identity or automatic claim",()=>{
 assert.match(signup,/company: companyHint/);
 assert.match(signup,/String\(companyHint \?\? ""\)\.trim\(\)\.slice\(0, 120\)/);
 assert.match(signup,/initialQuery=\{initialCompanySearch\}/g);
 assert.match(lookup,/defaultValue=\{initialQuery\.slice\(0,120\)\}/);
 assert.match(signup,/le aziende ancora da confermare non vengono rivendicate automaticamente/);
 assert.match(signup,/pa1_4_company_claim_context/);
 assert.doesNotMatch(activation,/service_role|p4_submit_inquiry_impl|netconnect1_submit/);
});

test("NET-CONNECT2: company claim remains distinct from platform verification and connections",()=>{
 assert.match(activation,/non attribuisce|senza diventare automaticamente verificato|senza diventare automaticamente verificato/);
 assert.match(claims,/non attribuisce il badge/);
 assert.doesNotMatch(activation,/status=.*approved|claimed_status="claimed"|followNetworkCompany/);
});
