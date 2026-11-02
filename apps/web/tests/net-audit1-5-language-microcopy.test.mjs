import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const load=async path=>{
  const source=read(path).replace(/^import .*;$/gm,"");
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
};
const it=await load("../lib/network-taxonomy-it.ts");
const ui=read("../components/network-compact-experience.tsx");
const profile=read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const chat=read("../components/network-conversation.tsx");
const bridge=read("../components/network-rfq-bridge.tsx");
const map=read("../components/network-europe-map.tsx");

test("NET-AUDIT1.5 Italian labels by key and by stored English name, with safe fallback",()=>{
  assert.equal(it.networkLabelIt("tubes_pipes"),"Tubi");
  assert.equal(it.networkLabelIt("cut_to_length"),"Taglio a misura");
  assert.equal(it.networkLabelIt("new_key","New label"),"New label");
  assert.equal(it.networkNameIt("Hollow sections"),"Profilati cavi");
  assert.equal(it.networkNameIt("Trader / Distributor"),"Commerciante");
  assert.equal(it.networkNameIt("Unknown family"),"Unknown family");
  const options=it.localizeTaxonomyOptions([{canonical_key:"tubes_pipes",display_name:"Tubes & pipes"},{canonical_key:"bars",display_name:"Bars"}]);
  assert.deepEqual(options.map(o=>[o.canonical_key,o.display_name]),[["bars","Barre"],["tubes_pipes","Tubi"]]);
});

test("NET-AUDIT1.5 list and profile show Italian taxonomy, keys untouched",()=>{
  assert.match(ui,/localizeTaxonomyOptions\(additionalFilters\?\.products\|\|\[\]\)/);
  assert.match(ui,/company\.products\.slice\(0,2\)\.map\(networkNameIt\)/);
  assert.match(ui,/capabilities\.slice\(0,2\)\.map\(networkNameIt\)/);
  assert.match(ui,/value=\{option\.canonical_key\}/);
  assert.match(profile,/\{networkNameIt\(primaryRole\.name\)\}/);
  assert.match(profile,/\{networkNameIt\(role\.name\)\}/);
  assert.match(profile,/\{networkNameIt\(capability\.name\)\}<\/p>/);
});

test("NET-AUDIT1.5 chat microcopy: opening examples, compact disclosure, real button name",()=>{
  assert.doesNotMatch(chat,/"E invece in Polonia\?"/);
  assert.match(chat,/"Tubo quadro 100x100x4 S355 a stock"/);
  assert.match(chat,/data-testid="network-chat-privacy"/);
  assert.match(chat,/<summary[^>]*>Privacy, voce e AI<\/summary>/);
  assert.match(chat,/Vercel AI Gateway/);
  assert.match(chat,/Nessuna RFQ viene inviata/);
  assert.match(bridge,/quando premi “Prepara articoli da rivedere”/);
  assert.doesNotMatch(bridge,/premi Analizza/);
  assert.match(map,/27 Paesi UE sulla mappa/);
});
