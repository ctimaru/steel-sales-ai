import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const bar = read("../components/network-inventory-bar.tsx");
const free = read("../components/free-network-directory.tsx");
const pro = read("../app/(italian)/(workspace)/network/page.tsx");
const directory = read("../lib/network-free.ts");
const discovered = read("../components/network-launch-discovery.tsx");

test("NET-LAUNCH5: Free and Pro always use actual published and provisional totals, never a hard-coded 500", () => {
  assert.match(free, /published=\{data\.published_page\.total\}/);
  assert.match(free, /unconfirmed=\{data\.discovery_page\?\.total\?\?0\}/);
  assert.match(pro, /published=\{results\.total\}/);
  assert.match(pro, /unconfirmed=\{previewDirectory\?\.discovered_total\?\?0\}/);
  assert.match(bar, /published\+unconfirmed/);
  assert.doesNotMatch(bar, /\b500\b/);
});
test("NET-LAUNCH5: provisional companies remain visible, labeled, and paged in both tiers", () => {
  assert.match(free, /<NetworkLaunchDiscovery/);
  assert.match(pro, /<NetworkLaunchDiscovery/);
  assert.match(discovered, /Esplora azienda/);
  assert.match(discovered, /<NetworkPagination/);
  assert.match(directory, /getNetworkBrowsePage\(organizationId,"free","unconfirmed"/);
  assert.match(directory, /getNetworkBrowsePage\(organizationId,"pro","unconfirmed"/);
  assert.match(directory, /p_limit:18/);
});
test("NET-LAUNCH5: real entitlement controls tier and an unavailable reader is never displayed as zero", () => {
  assert.match(pro, /getNetworkAccessState\(context\.organizationId\)/);
  assert.match(bar, /accessMode==="pro"\?"Pro":"Free"/);
  assert.match(bar, /Una delle fonti è temporaneamente indisponibile/);
  assert.match(free, /discoveryUnavailable=\{data\.discovery_unavailable\}/);
  assert.match(pro, /discoveryUnavailable=\{!previewDirectory\}/);
});
