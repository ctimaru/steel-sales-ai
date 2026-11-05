import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const load=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const layout=load("../app/(italian)/(workspace)/layout.tsx");
const gate=load("../components/network-perf-gate.tsx");
const panel=load("../components/network-perf-panel.tsx");

test("NET-PERF1.A: probe is restricted to platform superadmin and opt-in",()=>{
  assert.match(layout,/platformSuperadmin\s*=\s*context\.platformSuperadmin/);
  assert.match(layout,/platformSuperadmin\s*\?\s*<NetworkPerfGate\s*\/>/);
  assert.match(gate,/get\("netperf"\)\s*===\s*"1"/);
  assert.match(gate,/sessionStorage\.getItem\(ACTIVE_KEY\)/);
  assert.match(gate,/import\("\.\/network-perf-panel"\)/);
});

test("NET-PERF1.A: browser measurements never transmit data or capture input values",()=>{
  for(const forbidden of [/\bfetch\s*\(/,/\bsendBeacon\s*\(/,/localStorage\./,/\.value\s*\}/,/\.innerText\s*\}/,/\.href\s*\}/,/userAgent/]){
    assert.doesNotMatch(panel,forbidden);
  }
  assert.match(panel,/navigator\.clipboard\.writeText\(exportReport\(\)\)/);
  assert.match(panel,/new URLSearchParams\(location\.search\)/);
  assert.match(panel,/classifyRoute/);
  assert.match(panel,/sessionStorage/);
});

test("NET-PERF1.A: labels distinguish lab measurements from official Core Web Vitals",()=>{
  assert.match(panel,/not real-user p75 Core Web Vitals/);
  assert.match(panel,/NOT the official field INP algorithm/);
  assert.match(panel,/action_to_dom_update/);
  assert.match(panel,/full_document_to_probe_ready/);
  assert.match(panel,/p75Ms:soft\.length>=5/);
  assert.match(panel,/p75Ms:full\.length>=5/);
  assert.match(panel,/originalDocumentPath===\"\/network\"/);
});
