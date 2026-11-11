import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const free=read("../components/free-network-profile.tsx");
const pro=read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const overview=read("../components/network-profile-overview.tsx");

test("NET-PROFILE-UX1.A: both profile modes use the same identity, products and contact layout",()=>{
  for(const profile of [free,pro]){
    assert.match(profile,/<NetworkProfileOverview/);
    assert.match(profile,/primaryRole=/);
    assert.match(profile,/products=/);
    assert.match(profile,/website=/);
    assert.match(profile,/max-w-6xl/);
  }
  assert.match(overview,/Profilo aziendale/);
  assert.match(overview,/break-words text-xl/);
  assert.match(overview,/line-clamp-2 text-xs leading-5/);
  assert.match(overview,/lg:items-start/);
  assert.match(overview,/Cosa fa e cosa offre/);
  assert.match(overview,/aria-label="Attività e prodotti"/);
  assert.match(overview,/aria-label="Azioni commerciali"/);
  assert.match(overview,/aria-label="Contatti aziendali"/);
  assert.match(overview,/data-testid="network-profile-header-contact"/);
});

test("NET-PROFILE-UX1.A: actions are real, gated and precede optional detail panels",()=>{
  assert.match(pro,/inquiryEligible && canInteract/);
  assert.ok(pro.includes("Connetti"),"Pro connection label is present");
  assert.match(pro,/<NetworkSaveToggle/);
  assert.match(pro,/canWriteWorkspace\(membershipRole\)/);
  assert.match(pro,/data-testid="network-unclaimed-company-claim"/);
  assert.ok(pro.indexOf("<NetworkProfileOverview") < pro.indexOf('data-testid="network-unclaimed-company-claim"'));
  assert.match(pro,/data-testid="network-profile-technical-details"/);
  assert.match(free,/status==="available"&&canConnect/);
  assert.ok(free.includes("Connetti →"),"Free connection label is present");
  assert.match(free,/provisional\?"unavailable"/);
  assert.doesNotMatch(free,/non è possibile inviare richieste/);
  assert.ok(free.indexOf('actions={') < free.indexOf('data-testid="network-profile-free-evidence"'));
});

test("NET-PROFILE-UX1.A: provenance remains accessible without visual clutter or fake availability",()=>{
  assert.match(free,/Origine e attendibilità delle informazioni/);
  assert.match(free,/Vedi fonte aziendale/);
  assert.match(free,/reviewedEvidence.map/);
  assert.match(pro,/safeNetworkWebsiteUrl\(profile.company.website_url\)/);
  assert.match(pro,/href=\{"mailto:" \+ contact.email\}/);
  assert.match(pro,/href=\{"tel:" \+ contact.phone.replace/);
  assert.match(pro,/data-testid="network-profile-technical-details"/);
  assert.doesNotMatch(overview,/Da integrare|14%|Nessun prodotto pubblicato/);
  assert.doesNotMatch(overview,/A magazzino|Prossimi arrivi \/ produzioni|quantità inventata/);
  assert.match(free,/profile.products.length>0 \|\| profile.facilities.length>0/);
  assert.match(free,/sm:grid-cols-2/);
  assert.match(pro,/md:grid-cols-2 xl:grid-cols-4/);
});
