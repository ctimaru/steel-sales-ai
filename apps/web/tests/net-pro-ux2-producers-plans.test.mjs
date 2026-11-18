import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const entry=read("../components/network-producers-entry.tsx");
const compact=read("../components/network-compact-experience.tsx");
const exp=read("../components/network-producers-experience.tsx");

test("NET-PRO-UX2 one PRO strip: Intelligence Produttori + Moduli e prezzi, no data reads",()=>{
  assert.match(entry,/href=\{"\/network\/pro\/producers\?country=/);
  assert.match(entry,/data-testid="network-pro-plans-entry"/);
  assert.match(entry,/href="\/network\/pro"/);
  assert.match(entry,/NETWORK_PRO_PRICE_BOOK\.IT/);
  assert.doesNotMatch(entry,/🏭|async function|await /);
  assert.doesNotMatch(compact,/>\s*Network PRO · Moduli e prezzi\s*</,"no duplicate header link");
});

test("NET-PRO-UX2 producers: compact list with evidence chips, details on demand, sticky compare bar",()=>{
  assert.match(exp,/data-testid="network-producers-list"/);
  assert.match(exp,/data-testid="network-producer-row"/);
  assert.match(exp,/Dati tecnici con fonte · \{evidence\.length\}/);
  assert.match(exp,/Cataloghi ufficiali · \{docs\.length\}/);
  assert.match(exp,/Menzioni da qualificare · \{mentions\.length\}/);
  assert.match(exp,/Norme, gamma e cataloghi in qualificazione/);
  assert.match(exp,/Dettagli tecnici e fonti/);
  assert.match(exp,/data-testid="producer-compare-bar"/);
  assert.match(exp,/href="#producer-compare"/);
  assert.doesNotMatch(exp,/🏭/);
});

test("NET-PRO-UX2 speed: client-side search and instant skeletons",()=>{
  assert.match(exp,/import Form from "next\/form";/);
  assert.match(exp,/<Form action="\/network\/pro\/producers"/);
  for(const path of ["pro/loading.tsx","pro/producers/loading.tsx","pro/explore/loading.tsx"])
    assert.ok(existsSync(new URL("../app/(italian)/(workspace)/network/"+path,import.meta.url)),path);
});

test("NET-PRO-UX2 follow-up: comparison selection is scoped to current search, country and page",()=>{
  // Next/Form and Next/Link preserve the client component across navigations.
  // The selected list must be empty immediately when the query or page changes,
  // even before a state effect or an explicit form handler runs.
  assert.match(exp,/const selectionScope=JSON\.stringify\(\[query,page,country\]\)/);
  assert.match(exp,/const selected=selection\.scope===selectionScope\?selection\.ids:\[\]/);
  assert.match(exp,/const ids=current\.scope===selectionScope\?current\.ids:\[\]/);
  assert.match(exp,/const clearSelection=\(\)=>setSelection\(\{scope:selectionScope,ids:\[\]\}\)/);
  assert.equal((exp.match(/onClick=\{clearSelection\}/g)||[]).length,2,
    "both comparison clear controls must reset the current scope");
});
