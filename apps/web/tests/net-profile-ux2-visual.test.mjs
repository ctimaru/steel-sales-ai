import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const overview = read("../components/network-profile-overview.tsx");
const hub = read("../components/network-profile-hub.tsx");
const free = read("../components/free-network-profile.tsx");
const pro = read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const fixture = read("../app/(italian)/(workspace)/network-visual-qa/page.tsx");
const chrome = read("./netro14d-chrome-claimable-visual.mjs");

test("NET-PROFILE-UX6: founder concept is the same real five-card page for Free and PRO", () => {
  assert.match(overview, /data-profile-layout="concept-five-cards"/);
  assert.match(overview, /Scheda aziendale · Steel Industry Network/);
  assert.match(overview, /Profilo attuale/);
  assert.match(overview, /Sito aziendale/);
  const ordered = ["Attività e prodotti", "Stock e produzioni", "Contatti e sedi", "Connessioni", "Documenti e fonti"];
  const ids = ['id: "attivita"', 'id: "stock"', 'id: "contatti"', 'id: "connessioni"', 'id: "approfondimenti"'];
  let before = -1;
  for (let i = 0; i < ids.length; i++) {
    const after = overview.indexOf(ids[i]);
    assert.ok(after > before, ordered[i] + " is missing or not in the requested order");
    before = after;
    assert.match(overview, new RegExp(ordered[i]));
  }
  assert.match(hub, /lg:grid-cols-5/);
  assert.match(hub, /grid-cols-2 gap-2\.5 lg:grid-cols-5/);
  assert.match(hub, /Esplora le informazioni/);
  assert.match(hub, /sections\.map\(\(section\) =>/);
  assert.match(hub, /aria-pressed=\{current\}/);
  assert.match(hub, /onClick=\{\(\) => selectSection\(section\.id\)\}/);
  assert.match(hub, /scrollIntoView/);
  assert.match(hub, /prefers-reduced-motion/);
  assert.match(hub, /hidden=\{activeId !== section\.id\}/);
  assert.doesNotMatch(hub, /sections\.length === 1/);
  assert.doesNotMatch(overview, /if \(!hasPublishedActivities && stockCount === 0\)/);
  for (const source of [free, pro]) {
    assert.match(source, /<NetworkProfileTopBar\s*\/>/);
    assert.match(source, /<NetworkProfileOverview/);
    assert.match(source, /connectionsAvailable=/);
    assert.match(source, /detailsTargetId=/);
    assert.match(source, /stockCount=/);
    assert.match(source, /stockContent=/);
  }
});

test("NET-PROFILE-UX6: every card stays navigable without fabricating business data", () => {
  assert.match(overview, /const hasStock = stockCount > 0 && stockContent !== undefined/);
  assert.match(overview, /Nessuna disponibilità o produzione pubblicata/);
  assert.match(overview, /Prodotti e specializzazioni non ancora pubblicati/);
  assert.match(overview, /Nessuna azione commerciale disponibile/);
  assert.match(overview, /Nessun recapito o stabilimento pubblicato/);
  assert.match(overview, /Nessuna fonte web consultabile/);
  assert.match(overview, /connectionsAvailable && actions/);
  assert.match(overview, /data-testid="network-profile-quick-actions"/);
  assert.match(overview, /data-testid="network-company-source-attribution"/);
  assert.match(overview, /data-testid="network-profile-trust-panel"/);
  assert.match(overview, /hasCompanyDeclarations/);
  assert.match(overview, /hasVerifiedFields/);
  assert.doesNotMatch(overview, /Math\.random|fake stock|placeholder phone|quantità inventata/);
  assert.match(free, /canSave=!provisional && canWriteWorkspace\(workspace\.role\)/);
  assert.match(free, /provisional \? \[\] : await getPublishedNetworkInventory/);
  assert.match(free, /profile\.company\.verification_status==="verified" \? "verified"/);
  assert.match(pro, /standards=\{technicalStandards\.map/);
  assert.match(pro, /inquiryEligible && canInteract/);
});

test("NET-PROFILE-UX6: keyboard, provenance and explicit technical disclosures remain accessible", () => {
  assert.match(hub, /focus-visible:outline/);
  assert.match(hub, /role="region"/);
  assert.match(hub, /aria-controls=/);
  assert.match(hub, /data-testid="network-profile-open-details"/);
  assert.match(hub, /target\.open = true/);
  assert.match(pro, /data-testid="network-profile-technical-details" className="hidden open:block/);
  assert.match(free, /data-testid="network-profile-free-evidence" className="mt-4 hidden open:block/);
  assert.match(hub, /summary\.focus/);
  assert.match(overview, /Fonte web disponibile/);
  assert.match(overview, /Identità da confermare/);
  assert.match(overview, /Dati dichiarati dall’azienda/);
  assert.match(overview, /Elementi verificati/);
  assert.match(fixture, /NODE_ENV!=="development"/);
  assert.match(fixture, /NETWORK_VISUAL_FIXTURE!=="true"/);
  assert.match(fixture, /network-profile-asg-concept-fixture/);
  assert.match(fixture, /name="ASG S\.p\.A\."/);
  assert.match(fixture, /Tubi senza saldatura/);
  assert.match(chrome, /network-profile-asg-concept-fixture/);
  assert.match(chrome, /network-company-card-connessioni/);
  assert.match(chrome, /network-company-card-stock/);
});
