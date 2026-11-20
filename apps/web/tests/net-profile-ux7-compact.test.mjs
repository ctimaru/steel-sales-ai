import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const overview = read("../components/network-profile-overview.tsx");
const hub = read("../components/network-profile-hub.tsx");
const inventory = read("../components/network-profile-inventory.tsx");

test("NET-PROFILE-UX7: large five-card menu is replaced with dense, responsive tabs", () => {
  assert.match(overview, /data-profile-layout="compact-tabs"/);
  assert.match(hub, /data-profile-navigation="compact-tabs"/);
  assert.match(hub, /role="tablist"/);
  assert.match(hub, /role="tab"/);
  assert.match(hub, /role="tabpanel"/);
  assert.match(hub, /aria-selected=\{current\}/);
  assert.match(hub, /overflow-x-auto/);
  assert.match(hub, /min-h-12/);
  assert.doesNotMatch(hub, /min-h-\[160px\]|min-h-\[142px\]|grid-cols-5/);
  assert.doesNotMatch(overview, /concept-five-cards|Profilo attuale|rounded-\[26px\]/);
  assert.match(overview, /sm:h-16 sm:w-16/);
  assert.match(overview, /text-\[25px\]/);
});

test("NET-PROFILE-UX7: switching sections is client-side, keyboard accessible, and retains data provenance", () => {
  for (const id of ["attivita", "stock", "contatti", "approfondimenti"]) {
    assert.match(overview, new RegExp('id: "' + id + '"'));
    assert.match(hub, /sections\.map/);
  }
  assert.match(hub, /setSelected\(sectionId\)/);
  assert.match(hub, /ArrowRight/);
  assert.match(hub, /ArrowLeft/);
  assert.match(hub, /Home/);
  assert.match(hub, /End/);
  assert.match(hub, /prefers-reduced-motion/);
  assert.match(hub, /hidden=\{activeId !== section\.id\}/);
  assert.match(hub, /target\.open = true/);
  assert.match(overview, /data-testid="network-profile-trust-panel"/);
  assert.doesNotMatch(overview, /id: "connessioni"/);
  assert.match(overview, /data-testid="network-profile-request-rdo"/);
  assert.match(overview, /connectionsAvailable && actions/);
  assert.match(overview, /data-testid="network-company-source-attribution"/);
});

test("NET-PROFILE-UX7: stock and contact details are compact, with no invented data", () => {
  assert.match(overview, /<dl className="divide-y/);
  assert.match(overview, /data-testid="network-company-public-email"/);
  assert.match(overview, /data-testid="network-company-public-phone"/);
  assert.match(overview, /count: hasStock \? stockCount : undefined/);
  assert.match(inventory, /data-testid="network-profile-stock"/);
  assert.match(inventory, /divide-y divide-\[#e1e9e4\]/);
  assert.doesNotMatch(inventory, /rounded-3xl|rounded-2xl/);
  assert.match(inventory, /item\.quantity/);
  assert.match(inventory, /soggette a conferma/);
});
