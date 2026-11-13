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

test("NET-PROFILE-UX5.A/B: one shared information Hub with commercial actions in the hero", () => {
  assert.match(overview, /NetworkProfileTopBar/);
  assert.match(overview, /Torna alle aziende/);
  assert.match(overview, /data-testid="network-profile-ux1a"/);
  assert.match(overview, /<NetworkProfileHub sections=\{sections\}/);
  assert.match(overview, /Attività e prodotti/);
  assert.match(overview, /Contatti e sedi/);
  assert.match(overview, /Azioni disponibili/);
  assert.match(overview, /data-testid="network-profile-quick-actions"/);
  assert.doesNotMatch(overview, /id: "connessioni"/);
  assert.match(overview, /Stock e produzioni/);
  assert.match(hub, /"use client"/);
  assert.match(hub, /data-testid="network-company-card-hub"/);
  assert.match(hub, /aria-pressed=\{current\}/);
  assert.match(hub, /setSelected\(section.id\)/);
  assert.match(hub, /role="region"/);
  assert.ok(hub.includes("lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]"));
  assert.ok(overview.includes('const hubOrder = ["attivita", "contatti"'));
  assert.match(hub, /sections\.length === 1/);
  assert.match(hub, /network-company-single-panel/);
  assert.match(hub, /HTMLDetailsElement/);
  for (const source of [free, pro]) {
    assert.match(source, /<NetworkProfileTopBar\s*\/>/);
    assert.match(source, /<NetworkProfileOverview/);
    assert.match(source, /stockCount=/);
    assert.match(source, /stockContent=/);
    assert.match(source, /connectionsAvailable=/);
    assert.match(source, /primaryConnectionAvailable=/);
    assert.match(source, /detailsTargetId=/);
  }
});

test("NET-PROFILE-UX5.A/B: sparse profiles stay compact even with provenance, with no duplicate website CTA", () => {
  assert.match(overview, /if \(!hasPublishedActivities && stockCount === 0\)/);
  assert.match(overview, /data-profile-density="compact"/);
  assert.match(overview, /Visita il sito aziendale/);
  assert.match(overview, /Prodotti e specializzazioni non ancora pubblicati/);
  assert.match(overview, /if \(hasPublishedActivities\)/);
  assert.match(overview, /if \(hasContacts\)/);
  assert.match(overview, /if \(stockCount > 0 && stockContent\)/);
  assert.match(overview, /connectionsAvailable && actions/);
  assert.match(overview, /if \(hasTechnicalDetails \|\| hasWebSource/);
  assert.match(free, /provisional \? \[\] : await getPublishedNetworkInventory/);
  assert.match(free, /status==="available"&&canConnect/);
  assert.match(pro, /inquiryEligible && canInteract/);
  assert.match(pro, /<NetworkSaveToggle/);
  assert.match(free, /<NetworkSaveToggle/);
  assert.match(free, /canSave=!provisional && canWriteWorkspace\(workspace.role\)/);
  assert.match(free, /getSavedNetworkCompanyIds/);
  assert.match(overview, /primaryConnectionAvailable\s+\? "flex min-h-11/);
  assert.match(overview, /primaryConnectionAvailable \? "order-1" : "order-2"/);
  assert.doesNotMatch(overview, /Math.random|fake stock|placeholder phone|Da integrare/);
});

test("NET-PROFILE-UX5.A/B: responsive acceptance covers sparse, actionable and provisional data", () => {
  assert.match(fixture, /NODE_ENV!=="development"/);
  assert.match(fixture, /NETWORK_VISUAL_FIXTURE!=="true"/);
  assert.match(fixture, /DEMO Tubi Strutturali/);
  assert.match(fixture, /DEMO Acciai S.p.A./);
  assert.match(fixture, /network-profile-sparse-action-fixture/);
  assert.match(fixture, /network-profile-provisional-fixture/);
  assert.match(fixture, /<NetworkProfileOverview/);
  assert.match(fixture, /stockContent=\{<NetworkProfileInventory items=\{stockVisualFixture\}/);
  assert.match(chrome, /network-company-profile-ux2-full-admin/);
  assert.match(chrome, /network-company-profile-ux2-sparse-admin/);
  assert.match(chrome, /Company-commercial-hero/);
  assert.match(chrome, /Company-sparse-hero/);
  assert.match(chrome, /compactRect.height/);
});

test("NET-PROFILE-UX5.C: trust labels reflect distinct, evidenced claims", () => {
  assert.match(overview, /export type NetworkIdentityTrust/);
  assert.match(overview, /Identità da confermare/);
  assert.match(overview, /Identità non verificata/);
  assert.match(overview, /Profilo rivendicato/);
  assert.match(overview, /Azienda verificata/);
  assert.match(overview, /Fonte web disponibile/);
  assert.match(overview, /Dati dichiarati dall’azienda/);
  assert.match(overview, /Elementi verificati/);
  assert.match(overview, /Nessuno di questi segnali garantisce capacità di/);
  assert.match(overview, /title: "Fonti e attendibilità"/);
  assert.doesNotMatch(overview, /title: "Dati e documenti"/);
  assert.match(overview, /technicalTopics\.length \? "Apri dati tecnici pubblicati"/);
  assert.match(free, /identityTrust=\{provisional \? "unconfirmed"/);
  assert.match(free, /sourceUrl=\{source\}/);
  assert.match(pro, /identityTrust=\{profile\.trust\.verified \? "verified"/);
  assert.match(pro, /item\.provenance_kind === "company_declared"/);
  assert.match(pro, /hasVerifiedFields=\{verifiedAssetCount > 0\}/);
});

test("NET-PROFILE-UX5.C: all cards open an in-place panel, with an explicit technical drill-down", () => {
  assert.match(hub, /onClick=\{\(\) => setSelected\(section\.id\)\}/);
  assert.match(hub, /data-testid="network-profile-open-details"/);
  assert.match(hub, /onClick=\{\(\) => openTarget\(section\.targetId!\)\}/);
  assert.match(hub, /target\.open = true/);
  assert.match(hub, /summary\.focus/);
  assert.match(hub, /sections\[0\]\.targetId/);
  assert.doesNotMatch(hub, /onClick=\{\(\) => section\.targetId \? openTarget/);
  assert.match(overview, /trustSourceUrl && trustSourceUrl !== website/);
  assert.match(overview, /data-testid="network-profile-trust-panel"/);
  assert.match(fixture, /network-profile-public-source-fixture/);
  assert.match(fixture, /fixture-rich-technical-details/);
  assert.match(fixture, /identityTrust="unconfirmed"/);
  assert.match(chrome, /network-company-card-approfondimenti/);
  assert.match(chrome, /network-profile-open-details/);
});
