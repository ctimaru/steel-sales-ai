import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const page=read("../components/network-compact-experience.tsx");
const tech=read("../components/network-spec-filters.tsx");

test("FILTERBAR2: role controls share one compact row without a large, redundant header",()=>{
  const roleBar=page.indexOf('data-testid="network-compact-role-bar"');
  const roles=page.indexOf('aria-label="Ruolo nella filiera"',roleBar);
  const facets=page.indexOf('data-testid="network-filter-facets"',roles);
  assert.ok(roleBar>0&&roles>roleBar&&facets>roles);
  const block=page.slice(roleBar,facets);
  assert.match(block,/\>Filtri\<\/span\>/);
  assert.match(block,/min-h-11/); // 44px touch size, despite visually compact layout
  assert.doesNotMatch(block,/\>Filtra le aziende\</);
  assert.match(page,/data-testid="network-technical-filter-section"/);
  assert.match(page,/border-t border-\[#e3ebe5\] px-3 py-1\.5/);
  for(const label of ["Prodotti","Lavorazioni e servizi","Mercato"]){
    assert.ok(page.includes('label:"'+label+'"'));
  }
});

test("FILTERBAR2: technical spec stays collapsed by default, keeps selected spec visible, expands with accessible 44px target",()=>{
  assert.match(tech,/const active=NETWORK_SPEC_PARAMS\.some\(key=>Boolean\(filters\[key\]\)\)/);
  assert.match(tech,/<details open=\{active\}/);
  assert.match(tech,/data-testid="network-spec-panel"/);
  assert.match(tech,/min-h-11 cursor-pointer list-none/);
  assert.match(tech,/Norma · grado · misure/);
  assert.match(tech,/disabled=\{locked\}/);
  assert.match(tech,/NetworkFilterRouteForm/);
});

test("FILTERBAR2: Save/Connect teaching is one subtle expandable strip with full explanations preserved",()=>{
  const first=page.indexOf('function NetworkSaveConnectGuide()');
  assert.ok(first>0);
  const block=page.slice(first);
  assert.match(block,/data-testid="network-save-connect-guide"/);
  assert.match(block,/rounded-xl border border-\[#dce8e0\] bg-white px-3 py-1\.5/);
  assert.match(block,/<details className="group min-w-0">/);
  assert.match(block,/<summary className="flex min-h-9 cursor-pointer/);
  assert.match(block,/Come funziona\?/);
  assert.match(block,/Le vedi solo tu e l’azienda non riceve nulla/);
  assert.match(block,/può accettare o rifiutare/);
  assert.match(block,/href="\/network\/saved"/);
  assert.match(block,/href="\/network\/connections"/);
  assert.doesNotMatch(block,/bg-\[#fffaf0\]|bg-\[#f3faf6\]|flex h-10 w-10/);
});
