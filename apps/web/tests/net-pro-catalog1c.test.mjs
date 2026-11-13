import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const catalog=read("lib/network-pro-catalog.ts");
const view=read("components/network-pro-catalog.tsx");
const query=read("app/(italian)/(workspace)/network/pro/explore/page.tsx");
const scope=read("lib/network-pro-coverage.ts");

test("NET-PRO-CATALOG1.C carpenterie are in the processor module, not implicitly end users",()=>{
  assert.match(catalog,/key: "end_users",\s*title: "Utilizzatori industriali",\s*role: "end_user"/);
  assert.match(catalog,/key: "processors",\s*title: "Carpenterie e lavorazioni",\s*role: "processor_service_provider"/);
  assert.doesNotMatch(catalog,/title: "Carpenterie e utilizzatori"/);
  assert.match(catalog,/Le carpenterie e i terzisti sono nel modulo lavorazioni/);
  assert.match(catalog,/Il ruolo non certifica l’uso di tubi specifici/);
  assert.match(view,/non diventano automaticamente utilizzatori finali o acquirenti di tubi/);
});

test("NET-PRO-CATALOG1.C keeps server-side module and country access as source of truth",()=>{
  for(const [key,role] of [
    ["producers","producer"],["distributors","trader_distributor"],
    ["end_users","end_user"],["processors","processor_service_provider"],
  ]){
    assert.match(catalog,new RegExp('key: "'+key+'"'));
    assert.match(catalog,new RegExp('role: "'+role+'"'));
  }
  assert.match(query,/getNetworkProScopedDirectory/);
  assert.match(scope,/db\.rpc\("netpro1b_scoped_directory"/);
  assert.match(view,/country\.publishedModules\[module\.key\]/);
  assert.match(view,/country\.provisionalModules\[module\.key\]/);
  assert.match(view,/non sono incluse nei numeri/);
  assert.match(catalog,/purchasable: false as const/);
});
