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

test("NET-PROFILE-UX4: one shared Company Hub with clickable cards and real panels", () => {
  assert.match(overview, /NetworkProfileTopBar/);
  assert.match(overview, /Torna alle aziende/);
  assert.match(overview, /data-testid="network-profile-ux1a"/);
  assert.match(overview, /<NetworkProfileHub sections=\{sections\}/);
  assert.match(overview, /Attività e prodotti/);
  assert.match(overview, /Contatti e sedi/);
  assert.match(overview, /Connessioni/);
  assert.match(overview, /Stock e produzioni/);
  assert.match(hub, /"use client"/);
  assert.match(hub, /data-testid="network-company-card-hub"/);
  assert.match(hub, /aria-pressed=\{current\}/);
  assert.match(hub, /setSelected\(section.id\)/);
  assert.match(hub, /role="region"/);
  assert.match(hub, /grid-cols-2.*sm:grid-cols-3.*lg:grid-cols-5/);
  assert.match(hub, /HTMLDetailsElement/);
  for (const source of [free, pro]) {
    assert.match(source, /<NetworkProfileTopBar\s*\/>/);
    assert.match(source, /<NetworkProfileOverview/);
    assert.match(source, /stockCount=/);
    assert.match(source, /stockContent=/);
    assert.match(source, /connectionsAvailable=/);
    assert.match(source, /detailsTargetId=/);
  }
});

test("NET-PROFILE-UX4: empty cards and private data never become fake offers", () => {
  assert.match(overview, /if \(!hasPublishedActivities && !stockCount && !hasTechnicalDetails\)/);
  assert.match(overview, /data-profile-density="compact"/);
  assert.match(overview, /Visita il sito aziendale/);
  assert.match(overview, /Prodotti e specializzazioni non ancora pubblicati/);
  assert.match(overview, /if \(hasPublishedActivities\)/);
  assert.match(overview, /if \(hasContacts\)/);
  assert.match(overview, /if \(stockCount > 0 && stockContent\)/);
  assert.match(overview, /if \(connectionsAvailable && actions\)/);
  assert.match(overview, /if \(hasTechnicalDetails && detailsTargetId\)/);
  assert.match(free, /provisional \? \[\] : await getPublishedNetworkInventory/);
  assert.match(free, /status==="available"&&canConnect/);
  assert.match(pro, /inquiryEligible && canInteract/);
  assert.match(pro, /<NetworkSaveToggle/);
  assert.doesNotMatch(overview, /Math.random|fake stock|placeholder phone|Da integrare/);
});

test("NET-PROFILE-UX4: responsive visual acceptance uses synthetic local companies only", () => {
  assert.match(fixture, /NODE_ENV!=="development"/);
  assert.match(fixture, /NETWORK_VISUAL_FIXTURE!=="true"/);
  assert.match(fixture, /DEMO Tubi Strutturali/);
  assert.match(fixture, /DEMO Acciai S.p.A./);
  assert.match(fixture, /<NetworkProfileOverview/);
  assert.match(fixture, /stockContent=\{<NetworkProfileInventory items=\{stockVisualFixture\}/);
  assert.match(chrome, /network-company-profile-ux2-full-admin/);
  assert.match(chrome, /network-company-profile-ux2-sparse-admin/);
  assert.match(chrome, /Company-commercial-hero/);
  assert.match(chrome, /Company-sparse-hero/);
  assert.match(chrome, /compactRect.height/);
});
