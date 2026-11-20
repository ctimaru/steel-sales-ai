import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const overview = read("../components/network-profile-overview.tsx");
const hub = read("../components/network-profile-hub.tsx");
const free = read("../components/free-network-profile.tsx");
const pro = read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const save = read("../components/network-save-toggle.tsx");
const route = read("../lib/new-request-href.ts");
const requestPage = read("../app/(italian)/(workspace)/rfq-hub/distinta/page.tsx");
const builder = read("../components/buyer-distinta-builder.tsx");

test("NET-PROFILE-UX8: four compact information tabs, no connection card", () => {
  for(const id of ["attivita","stock","contatti","approfondimenti"])
    assert.match(overview,new RegExp('id: "'+id+'"'));
  assert.doesNotMatch(overview,/id: "connessioni"/);
  assert.match(hub,/role="tablist"/);
  assert.match(hub,/aria-selected=\{current\}/);
  assert.match(overview,/data-testid="network-profile-industrial-summary"/);
  assert.match(overview,/Lavorazioni e specializzazioni/);
  assert.match(overview,/Norme pubblicate/);
});

test("NET-PROFILE-UX8: original saved-company toggle and connection action stay in header", () => {
  assert.match(overview,/data-testid="network-profile-hero-actions"/);
  assert.match(overview,/data-testid="network-profile-quick-actions"/);
  assert.match(overview,/connectionsAvailable && actions/);
  assert.match(free,/NetworkSaveToggle/);
  assert.match(pro,/NetworkSaveToggle/);
  assert.match(free,/appearance="toolbar"/);
  assert.match(pro,/appearance="toolbar"/);
  assert.match(save,/appearance\?: "button" \| "ghost" \| "toolbar"/);
  assert.match(save,/toggleNetworkSavedCompany\(companyId, wanted, surface\)/);
  assert.match(free,/href=\{"\/network\/"\+companyId\+"\/connect"\}/);
  assert.match(pro,/href=\{"\/network\/" \+ profile.company.id \+ "\/connect"\}/);
});

test("NET-PROFILE-UX8: RDO is a linked Distinta flow with consent and role gates", () => {
  assert.match(overview,/data-testid="network-profile-request-rdo"/);
  assert.match(overview,/href=\{requestHref\}/);
  assert.match(free,/!provisional && canWriteWorkspace\(workspace\.role\) \? newRequestHref\(\{network: companyId\}\)/);
  assert.match(pro,/organizationId && canWriteWorkspace\(membershipRole\) \? newRequestHref\(\{network: profile\.company\.id\}\)/);
  assert.match(route,/const BASE = "\/rfq-hub\/distinta"/);
  assert.match(route,/UUID\.test\(options\.network\)/);
  assert.match(requestPage,/getCommercialNetworkContext\(context\.organizationId, params\.network\)/);
  assert.match(requestPage,/stepTwoNetworkCompanyId=\{networkContext\?\.id \?\? null\}/);
  assert.match(builder,/stepTwoNetworkCompanyId \? "\?dal=" \+ encodeURIComponent\(stepTwoNetworkCompanyId\)/);
  assert.match(builder,/createBuyerRfqCampaign\(savedId\)/);
  assert.doesNotMatch(overview,/createBuyerRfqCampaign|addSupplierToBuyerRfq|dispatchBuyerRfq|send.*email/i);
});
