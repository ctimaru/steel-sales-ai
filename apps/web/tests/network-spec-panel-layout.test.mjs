import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const spec=read("../components/network-spec-filters.tsx");
const page=read("../components/network-compact-experience.tsx");
const chrome=read("./netro14d-chrome-claimable-visual.mjs");
const workflow=read("../../../.github/workflows/net-ux-filters1-responsive.yml");

test("NET-UX-TECH1 compact technical accordion matches Network filter styling",()=>{
  assert.match(page,/network-technical-filter-section/);
  assert.match(spec,/network-spec-summary/);
  assert.match(spec,/Norma · grado · misure/);
  assert.match(spec,/group-open:rotate-180/);
  assert.match(spec,/accessMode!=="pro"/);
  assert.match(spec,/disabled=\{locked\}/);
});

test("NET-UX-TECH1 measurement controls are organized in paired 44px rows",()=>{
  assert.match(spec,/h-11 w-full min-w-0 rounded-xl/);
  assert.match(spec,/network-spec-material/);
  assert.match(spec,/network-spec-geometry/);
  assert.match(spec,/network-spec-diameter-row/);
  assert.match(spec,/network-spec-sides-row/);
  for(const name of ['"od"','"wt"','"side"','"side2"'])
    assert.ok(spec.includes("field("+name+","),"Missing "+name);
  assert.match(spec,/min-h-11 w-full items-center justify-center/);
});

test("NET-UX-TECH1 preserves combined filters and existing GET contract",()=>{
  for(const key of ["q","role","region","country","persona","steel","product","capability","market"])
    assert.ok(spec.includes('"'+key+'"'),"Lost preserved filter: "+key);
  assert.match(spec,/method="get" action="\/network"/);
  assert.match(spec,/key!=="np"/);
  assert.match(spec,/NETWORK_SPEC_STANDARD_SUGGESTIONS/);
  assert.match(spec,/NETWORK_SPEC_SHAPES/);
});

test("NET-UX-TECH1 real Chrome checks open technical panel at all viewports",()=>{
  assert.match(chrome,/for \(const width of \[1440,390,320\]\)/);
  assert.match(chrome,/network-technical-spec-open-admin/);
  assert.match(chrome,/Misaligned technical dimensions/);
  assert.match(workflow,/apps\/web\/components\/network-spec-filters\.tsx/);
  assert.match(workflow,/apps\/web\/tests\/network-spec-panel-layout\.test\.mjs/);
});