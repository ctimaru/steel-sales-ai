import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const load=(p,requireFn=()=>{throw Error("Unexpected dependency")})=>{
 const mod={exports:{}};
 const code=ts.transpileModule(read(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function("require","module","exports",code)(requireFn,mod,mod.exports);
 return mod.exports;
};
const catalog=load("lib/network-pro-catalog.ts");
const {foundingQuote,FOUNDING_PRESETS,FOUNDING_TERM_MONTHS}=load("lib/founding-partners-preview.ts",n=>{assert.equal(n,"@/lib/network-pro-catalog");return catalog;});
test("D.2 all 16 module combinations and untrusted selections remain marketing-only",()=>{
 const keys=catalog.NETWORK_PRO_MODULES.map(m=>m.key);
 const prices=[0,29,49,69,89];
 for(let mask=0;mask<16;mask++){
  const selected=keys.filter((_,i)=>mask&(1<<i));
  const q=foundingQuote([...selected,...selected,"invalid","EU"]);
  assert.deepEqual(q.selected,selected);assert.equal(q.count,selected.length);
  assert.equal(q.monthly,prices[selected.length]);assert.equal(q.reference,catalog.NETWORK_PRO_PRICE_BOOK.IT[selected.length]);
  assert.equal(q.annualDifference,(q.reference-q.monthly)*FOUNDING_TERM_MONTHS);
  assert.equal(q.territory,"IT");assert.equal(q.purchasable,false);
 }
 for(const preset of Object.values(FOUNDING_PRESETS))assert.equal(foundingQuote(preset).count,preset.length);
});
test("D.2 only owner preview, no collection or payments",()=>{
 const route=read("app/(italian)/(platform)/platform/marketing/founding-partners/page.tsx");
 const ui=read("components/founding-partners-preview.tsx");
 assert.match(route,/await requirePlatformSuperadmin\(\)/);
 assert.match(route,/dynamic = "force-dynamic"/);
 assert.match(route,/index:false,follow:false/);
 assert.match(ui,/useState<NetworkProModuleKey\[\]>\(\[\]\)/);
 assert.match(ui,/disabled data-testid="founding-reserve"/);
 assert.doesNotMatch(ui,/\bfetch\s*\(|localStorage|sessionStorage|<form\b|<input\b|createClient|checkout|server action/i);
});
