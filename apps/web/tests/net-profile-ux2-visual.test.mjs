import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path,import.meta.url),"utf8");
const overview = read("../components/network-profile-overview.tsx");
const free = read("../components/free-network-profile.tsx");
const pro = read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const fixture = read("../app/(italian)/(workspace)/network-visual-qa/page.tsx");
const chrome = read("./netro14d-chrome-claimable-visual.mjs");

test("NET-PROFILE-UX2: one clear company identity and first-screen sales actions in Free and Pro",() => {
  assert.match(overview,/NetworkProfileTopBar/);
  assert.match(overview,/Torna alle aziende/);
  assert.match(overview,/Scheda aziendale/);
  assert.match(overview,/data-testid="network-profile-ux1a"/);
  assert.match(overview,/aria-label="Attività e prodotti"/);
  assert.match(overview,/aria-label="Azioni commerciali"/);
  assert.match(overview,/aria-label="Contatti aziendali"/);
  assert.match(overview,/lg:grid-cols-\[minmax\(0,1fr\)_308px\]/);
  assert.match(overview,/order-1/);
  assert.match(overview,/Cosa fa e cosa offre/);
  for(const source of [free,pro]){
    assert.match(source,/<NetworkProfileTopBar\s*\/>/);
    assert.match(source,/<NetworkProfileOverview/);
    assert.match(source,/aria-label="Naviga la scheda"/);
    assert.match(source,/publishedInventory.length|inventory.length/);
    assert.match(source,/href="#stock"/);
  }
});
test("NET-PROFILE-UX2: sparse companies never gain invented activity or availability",() => {
  assert.match(overview,/Informazioni commerciali non ancora pubblicate/);
  assert.match(overview,/!hasCommercialDetails/);
  assert.match(overview,/hasContacts \? \(/); // empty contact message is guarded
  assert.match(overview,/Recapiti diretti non pubblicati/);
  assert.match(overview,/visibleProducts\.length/);
  assert.match(overview,/visibleServices\.length/);
  assert.match(free,/provisional \? \[\] : await getPublishedNetworkInventory/);
  assert.match(free,/status==="available"&&canConnect/);
  assert.match(pro,/inquiryEligible && canInteract/);
  assert.match(pro,/<NetworkSaveToggle/);
  assert.match(overview,/website \? \(/);
  assert.doesNotMatch(overview,/Math\.random|fake stock|placeholder phone|Da integrare/);
});
test("NET-PROFILE-UX2: review real UI components at 1440, 390 and 320 for full and sparse states",() => {
  assert.match(fixture,/NODE_ENV!=="development"/);
  assert.match(fixture,/NETWORK_VISUAL_FIXTURE!=="true"/);
  assert.match(fixture,/DEMO Tubi Strutturali/);
  assert.match(fixture,/DEMO Acciai S.p.A./);
  assert.match(fixture,/<NetworkProfileOverview/);
  assert.match(chrome,/network-company-profile-ux2-full-admin/);
  assert.match(chrome,/network-company-profile-ux2-sparse-admin/);
  assert.ok(chrome.includes('await noOverflow(page,"Company-commercial-hero/"+width)'));
  assert.ok(chrome.includes('await noOverflow(page,"Company-sparse-hero/"+width)'));
});

test("NET-PROFILE-UX3: sparse company is a compact directory profile with primary real contact",() => {
  assert.match(overview,/const hasPublishedActivities = Boolean/);
  assert.match(overview,/if \(!hasPublishedActivities\)/);
  assert.match(overview,/data-profile-density="compact"/);
  assert.match(overview,/Visita il sito aziendale/);
  assert.match(overview,/Prodotti e specializzazioni non ancora pubblicati/);
  assert.match(pro,/An unavailable connection is not an action/);
  assert.doesNotMatch(pro,/Connessione nella piattaforma non disponibile/);
  assert.doesNotMatch(free,/Disponibilità delle connessioni temporaneamente non verificabile/);
  assert.match(chrome,/compactRect.height/);
  assert.match(chrome,/network-company-profile-ux2-sparse-admin/);
});
