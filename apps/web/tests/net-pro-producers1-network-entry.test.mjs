import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const entry=read("components/network-producers-entry.tsx");
const compact=read("components/network-compact-experience.tsx");
const free=read("components/free-network-directory.tsx");
const network=read("app/(italian)/(workspace)/network/page.tsx");
const producers=read("app/(italian)/(workspace)/network/pro/producers/page.tsx");
const technical=read("lib/network-producer-technical.ts");
const catalog=read("lib/network-producer-catalogs.ts");

test("NET-PRO-PRODUCERS1.NAV: visible first-screen entry links to real Producer PRO route",()=>{
  assert.match(entry,/data-testid="network-producers-entry"/);
  assert.match(entry,/aria-label="Intelligence Produttori"/);
  assert.match(entry,/href=\{"\/network\/pro\/producers\?country=/);
  assert.match(entry,/Esplora produttori/);
  assert.match(entry,/min-h-11/);
  assert.match(entry,/focus-visible:outline/);
  assert.match(compact,/<NetworkProducersEntry country=\{filters\.country\|\|"IT"\}\s*\/>/);
  assert.match(compact,/accessMode:"free"\|"pro"/);
  assert.ok(compact.indexOf("<NetworkProducersEntry country=")<compact.indexOf("<NetworkCountryTicker"),"Place before country ticker and map");
  assert.match(free,/<NetworkProducersEntry\s*\/>/);
  assert.match(network,/<NetworkProducersEntry\s*\/>/);
});

test("NET-PRO-PRODUCERS1.NAV: entry is navigation only; technical data require paid server RPC",()=>{
  assert.doesNotMatch(entry,/db\.rpc|createClient|fetch\(|service_role|SUPABASE_SERVICE_ROLE_KEY|stripe/i);
  assert.match(producers,/result\.status==="ready"/);
  assert.match(producers,/getNetworkProScopedDirectory/);
  assert.match(producers,/module:"producers"/);
  assert.match(producers,/isSupportedNetworkCountry/);
  assert.match(producers,/country,\s*\n\s*q:query/);
  assert.match(producers,/getProducerTechnicalClaims/);
  assert.match(technical,/db\.rpc\("netproducers1_technical_claims"/);
  assert.match(catalog,/db\.rpc\("netproducers1_catalog_index"/);
});
