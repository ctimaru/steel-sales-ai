import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const ui=read("components/network-pro-catalog.tsx");
const data=read("lib/network-pro-coverage.ts");
const price=read("lib/network-pro-catalog.ts");

test("NET-PRO-CATALOG1.D uses only live published role counts in module cards",()=>{
  assert.match(ui,/const publishedInTerritory = coverage\s*\? countries\.reduce\(\(total, country\) => total \+ country\.publishedModules\[module\.key\], 0\)/);
  assert.match(ui,/publishedInTerritory===null\s*\? "Copertura pubblicata non disponibile"/);
  assert.match(ui,/data-testid=\{"netpro1d-live-count-"\+module\.key\}/);
  assert.match(ui,/publishedInTerritory===1\?"profilo pubblicato":"profili pubblicati"/);
  assert.match(ui,/territory==="IT"\?"in Italia":"nei Paesi europei censiti"/);
  assert.doesNotMatch(ui,/publishedInTerritory\s*=\s*.*provisionalModules/);
  assert.match(data,/publishedModules:NetworkProModuleCounts/);
  assert.match(data,/provisionalModules:NetworkProModuleCounts/);
});

test("D does not grant access or turn proposed pricing into a purchasable checkout",()=>{
  assert.match(price,/purchasable: false as const/);
  assert.match(ui,/Prezzi proposti, ancora da validare/);
  assert.match(ui,/access\?\.modules\[module\.key\]/);
  assert.match(ui,/data-testid="netpro1b-coverage"/);
});
