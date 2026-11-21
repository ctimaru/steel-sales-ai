import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const publicCard = read("../components/public-network-pro.tsx");
const dashboardCard = read("../components/home-network-pro-card.tsx");
const network = read("../components/network-compact-experience.tsx");
const ticker = read("../components/network-country-ticker.tsx");
const map = read("../components/network-europe-map.tsx");
const legacy = read("../components/network-inventory-bar.tsx");
const shared = read("../lib/public-network-counts.ts");

test("COUNT-PARITY1: Home and Network headline use the same published-only server RPC", () => {
  assert.match(shared, /rpc\("public_network_counts"\)/);
  assert.match(publicCard, /getPublicNetworkCounts\(\)/);
  assert.match(publicCard, /aziende pubblicate/);
  assert.match(dashboardCard, /aziende pubblicate nel Network/);
  assert.match(network, /import \{getPublicNetworkCounts\} from "@\/lib\/public-network-counts"/);
  assert.match(network, /const globalCount=publishedCounts\?\.total\?\?null/);
  assert.doesNotMatch(network, /sum\+item\.total,0/);
});

test("COUNT-PARITY1: unconfirmed profiles remain available but never inflate public totals, ticker or map", () => {
  assert.match(network, /sum\+item\.sourced,0/);
  assert.match(network, /> da confermare/);
  assert.match(network, /directory\.discovered>0/);
  assert.match(ticker, /item\.published\.toLocaleString\("it-IT"\)/);
  assert.doesNotMatch(ticker, /item\.total\.toLocaleString\("it-IT"\)/);
  assert.match(network, /countryCounts=\{Object\.fromEntries\(networkCountries\.map\(item=>\[item\.countryCode,item\.published\]\)\)\}/);
  assert.match(map, /aziende pubblicate/);
  assert.doesNotMatch(legacy, /published\+unconfirmed/);
  assert.match(legacy, /schede da confermare/);
});
