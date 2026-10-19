import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const parserSource=read("../lib/network-intent-parser.ts");
const compiled=ts.transpileModule(parserSource,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText;
const runtime={exports:{}};
new Function("module","exports",compiled)(runtime,runtime.exports);
const {interpretNetworkIntent,networkIntentHref}=runtime.exports;

const taxonomy={
  regions:["Lombardia","Veneto","Piemonte","Valle d'Aosta"],
  products:[
    {canonical_key:"tubes_pipes",display_name:"Tubi e tubazioni"},
    {canonical_key:"sheet_steel",display_name:"Lamiere"},
    {canonical_key:"precision_tubes",display_name:"Precision steel tubes"},
  ],
  capabilities:[
    {canonical_key:"laser_cutting",display_name:"Taglio laser"},
    {canonical_key:"bending",display_name:"Bending"},
  ],
  markets:[
    {canonical_key:"automotive",display_name:"Automotive"},
    {canonical_key:"energy",display_name:"Energy"},
  ],
};
test("COMPACT6B reads English role, regional alias and count intent, without invented totals",()=>{
  const p=interpretNetworkIntent("How many tube traders in Lombardy?",taxonomy);
  assert.equal(p.status,"ready");
  assert.equal(p.intent,"count");
  assert.deepEqual(p.filters,{role:"trader_distributor",region:"Lombardia",country:"IT",product:"tubes_pipes"});
  assert.equal(p.technicalOnly,true);
  assert.ok(networkIntentHref(p)?.includes("product=tubes_pipes"));
  assert.equal(Object.hasOwn(p,"count"),false);
});
test("COMPACT6B resolves French trader/manufacturer and Lombardie",()=>{
  const p=interpretNetworkIntent("Je cherche des fabricants en Lombardie",taxonomy);
  assert.equal(p.status,"ready");
  assert.equal(p.filters.role,"producer");
  assert.equal(p.filters.region,"Lombardia");
  assert.equal(p.unsupported.length,0);
});
test("COMPACT6B resolves Spanish tube manufacturers in Veneto",()=>{
  const p=interpretNetworkIntent("Busco fabricantes de tubos en Veneto",taxonomy);
  assert.equal(p.status,"ready");
  assert.deepEqual(p.filters,{role:"producer",region:"Veneto",country:"IT",product:"tubes_pipes"});
});
test("COMPACT6B resolves German distributors in der Lombardei",()=>{
  const p=interpretNetworkIntent("Ich suche Rohrhändler in der Lombardei",taxonomy);
  assert.equal(p.status,"ready");
  assert.deepEqual(p.filters,{role:"trader_distributor",region:"Lombardia",country:"IT"});
});
test("COMPACT6B resolves foreign-country manufacturers without Italian region",()=>{
  const p=interpretNetworkIntent("Manufacturers in Germany",taxonomy);
  assert.equal(p.status,"ready");
  assert.deepEqual(p.filters,{role:"producer",country:"DE"});
});
test("COMPACT6B recognizes exactly published capability taxonomy",()=>{
  const p=interpretNetworkIntent("Cerco terzisti con Taglio laser in Lombardia",taxonomy);
  assert.equal(p.status,"ready");
  assert.equal(p.filters.capability,"laser_cutting");
  assert.equal(p.technicalOnly,true);
  assert.ok(p.chips.includes("Capacità: Taglio laser"));
  assert.match(networkIntentHref(p),/capability=laser_cutting/);
});
test("COMPACT6B recognizes published market taxonomy across languages",()=>{
  const p=interpretNetworkIntent("Traders in Lombardy for Automotive",taxonomy);
  assert.equal(p.status,"ready");
  assert.equal(p.filters.market,"automotive");
  assert.ok(p.chips.includes("Mercato: Automotive"));
  assert.match(networkIntentHref(p),/market=automotive/);
});
test("COMPACT6B accepts an exact published product name without generic guesses",()=>{
  const p=interpretNetworkIntent("Produttori di Lamiere in Veneto",taxonomy);
  assert.equal(p.status,"ready");
  assert.equal(p.filters.product,"sheet_steel");
  assert.match(networkIntentHref(p),/product=sheet_steel/);
});
test("COMPACT6B prefers a long exact taxonomy product over a shorter tube synonym",()=>{
  const p=interpretNetworkIntent("Manufacturers of Precision steel tubes in Italy",taxonomy);
  assert.equal(p.status,"ready");
  assert.equal(p.filters.product,"precision_tubes");
  assert.match(networkIntentHref(p),/product=precision_tubes/);
});
test("COMPACT6B rejects multiple different capabilities instead of silently using the first",()=>{
  const p=interpretNetworkIntent("Terzisti con Taglio laser e Bending in Lombardia",taxonomy);
  assert.equal(p.status,"unsupported");
  assert.ok(p.unsupported.some(x=>x.includes("più capacità")));
  assert.equal(networkIntentHref(p),null);
});
test("COMPACT6B rejects identical labels used by multiple technical categories",()=>{
  const p=interpretNetworkIntent("Produttori di Automotive in Veneto",{
    ...taxonomy,products:[...taxonomy.products,{canonical_key:"automotive_products",display_name:"Automotive"}],
  });
  assert.equal(p.status,"unsupported");
  assert.ok(p.unsupported.some(x=>x.includes("attributo ambiguo")));
  assert.equal(networkIntentHref(p),null);
});
test("COMPACT6B rejects unknown production process and delivery requirements",()=>{
  for(const raw of [
    "Cerco terzisti con galvanizzazione in Lombardia",
    "Traders delivering tomorrow in Veneto",
    "40 tubes S235 EN 10219 with laser cutting",
  ]){
    const p=interpretNetworkIntent(raw,taxonomy);
    assert.equal(p.status,"unsupported",raw);
    assert.equal(networkIntentHref(p),null);
  }
});
test("COMPACT6B rejects missing taxonomy rather than inventing a technical match",()=>{
  const p=interpretNetworkIntent("Produttori di Lamiere in Lombardia",{regions:taxonomy.regions});
  assert.equal(p.status,"unsupported");
  assert.equal(networkIntentHref(p),null);
});
test("COMPACT6B Free/Pro shares sourced taxonomy and never creates a competing search backend",()=>{
  const ui=read("../components/network-compact-experience.tsx");
  const panel=read("../components/network-conversation.tsx");
  const action=read("../app/(italian)/(workspace)/network/conversation-actions.ts");
  const data=read("../lib/network-compact-directory.ts");
  assert.match(ui,/<NetworkConversation userId=\{userId\} organizationId=\{organizationId\} canCompose=\{canCompose\}\/>/);
  assert.match(action,/interpretNetworkIntent\(query,taxonomy\)/);
  assert.match(panel,/IT · EN · DE · FR · ES/);
  assert.match(action,/I dati tecnici si riferiscono ai soli profili pubblicati/);
  assert.match(panel,/disabled=\{busy\|\|draft.trim\(\).length<3\}/);
  assert.match(data,/await getNetworkBrowsePage\(organizationId,access,"published"/);
  assert.doesNotMatch(panel,/fetch\(|service_role|generateText|apiKey/);
  assert.match(action,/getNetworkAccessState\(context.organizationId\)/);
});
