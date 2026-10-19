import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const source=read("../lib/network-intent-parser.ts");
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const runtime={exports:{}};
new Function("module","exports",output)(runtime,runtime.exports);
const {interpretNetworkIntent,networkIntentHref}=runtime.exports;

const available={
  regions:["Lombardia","Veneto","Piemonte","Valle d'Aosta"],
  products:[{canonical_key:"tubes_pipes",display_name:"Tubi e tubazioni"}],
};

test("COMPACT6A extracts exact Italian commercial role and regional intent",()=>{
  const p=interpretNetworkIntent("Cerco commercianti in Lombardia",available);
  assert.equal(p.status,"ready");
  assert.deepEqual(p.filters,{role:"trader_distributor",region:"Lombardia",country:"IT"});
  assert.deepEqual(p.unsupported,[]);
  assert.equal(p.technicalOnly,false);
  assert.equal(networkIntentHref(p),"/network?role=trader_distributor&region=Lombardia&country=IT#network-results");
});
test("COMPACT6A translates a count question but never invents numbers",()=>{
  const p=interpretNetworkIntent("Quanti commercianti ci sono in Piemonte?",available);
  assert.equal(p.status,"ready");
  assert.equal(p.intent,"count");
  assert.equal(p.filters.region,"Piemonte");
  assert.equal(Object.prototype.hasOwnProperty.call(p,"count"),false);
});
test("COMPACT6A recognizes the tube taxonomy and warns about published-only scope",()=>{
  const p=interpretNetworkIntent("Cerco commercianti di tubi in Lombardia",available);
  assert.equal(p.status,"ready");
  assert.deepEqual(p.filters,{role:"trader_distributor",region:"Lombardia",country:"IT",product:"tubes_pipes"});
  assert.equal(p.technicalOnly,true);
  assert.ok(p.chips.some(chip=>chip.includes("prodotti dichiarati")));
});
test("COMPACT6A does not silently filter an unsupported product taxonomy",()=>{
  const p=interpretNetworkIntent("Commercianti di tubi in Lombardia",{regions:available.regions});
  assert.equal(p.status,"unsupported");
  assert.ok(p.unsupported.some(value=>value.includes("filtro tecnico non disponibile")));
  assert.equal(networkIntentHref(p),null);
});
test("COMPACT6A recognizes foreign country and never emits Italian region there",()=>{
  const p=interpretNetworkIntent("Mostrami i produttori in Germania",available);
  assert.equal(p.status,"ready");
  assert.deepEqual(p.filters,{role:"producer",country:"DE"});
  assert.equal(p.technicalOnly,true);
});
test("COMPACT6A rejects contradictory geography and role requests rather than dropping criteria",()=>{
  const p=interpretNetworkIntent("Produttori e commercianti in Germania e Lombardia",available);
  assert.equal(p.status,"unsupported");
  assert.ok(p.unsupported.some(value=>value.includes("più ruoli")));
  assert.ok(p.unsupported.some(value=>value.includes("regione italiana con paese estero")));
  assert.equal(networkIntentHref(p),null);
});
test("COMPACT6A refuses unknown grades, quantities or delivery constraints",()=>{
  for(const input of ["Cerco 40 tubi da 3 metri in Lombardia","Commercianti di S235 in Veneto","Fornitori con consegna domani a Torino"]){
    const p=interpretNetworkIntent(input,available);
    assert.equal(p.status,"unsupported",input);
    assert.equal(networkIntentHref(p),null);
  }
});
test("COMPACT6A does not redirect a company's proper name to a false product filter",()=>{
  const p=interpretNetworkIntent("Padana Tubi",available);
  assert.equal(p.status,"unsupported");
  assert.ok(p.unsupported.includes("padana"));
  assert.equal(networkIntentHref(p),null);
});
test("COMPACT6A handles regional diacritics, excess length and empty requests",()=>{
  const p=interpretNetworkIntent("Utilizzatori in Valle d'Aosta",available);
  assert.equal(p.status,"ready");
  assert.equal(p.filters.region,"Valle d'Aosta");
  assert.equal(interpretNetworkIntent("   ").status,"empty");
  const long=interpretNetworkIntent("produttori ".repeat(500),available);
  assert.ok(["ready","unsupported"].includes(long.status));
  assert.ok(Object.keys(long.filters).every(key=>["role","region","country","product"].includes(key)));
});
test("COMPACT6A UI keeps real Network access gating and existing search",()=>{
  const ui=read("../components/network-compact-experience.tsx");
  const discover=read("../components/network-intent-search.tsx");
  const list=read("../lib/network-compact-directory.ts");
  assert.match(ui,/<NetworkLiveSearch filters=\{filters\}\/>/);
  assert.match(ui,/<NetworkConversation\/>/);
  assert.match(read("../app/(italian)/(workspace)/network/conversation-actions.ts"),/getNetworkTaxonomy\(\)/);
  assert.match(discover,/networkIntentHref\(parsed\)/);
  assert.match(discover,/disabled=\{!href\|\|pending\}/);
  assert.match(discover,/Filtri riconosciuti/);
  assert.match(discover,/risultati reali del Network/);
  assert.match(discover,/aziende censite senza tali dati non sono conteggiate/);
  assert.match(list,/await getNetworkBrowsePage\(organizationId,access,"published"/);
  assert.match(list,/await withCompactGeoEvidence/);
  assert.doesNotMatch(discover,/fetch\(|openai|generateText|service_role/);
});
