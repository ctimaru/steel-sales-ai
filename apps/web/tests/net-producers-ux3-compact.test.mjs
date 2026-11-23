import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";

// NET-PRODUCERS-UX3 (founder request, 23 Nov 2026): compact producers page.
const file=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const helpers=file("lib/network-producer-highlights.ts");
const page=file("components/network-producers-experience.tsx");
const chat=file("components/eu-producer-intelligence-chat.tsx");
const route=file("app/(italian)/(workspace)/network/pro/producers/page.tsx");

function runtime(source){
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function("require","module","exports",compiled)(()=>{throw Error("no deps");},module,module.exports);
  return module.exports;
}
const h=runtime(helpers);
const value=(id,kind,v,url="https://example.it/p")=>({id,kind,value:v,sourceUrl:url});

test("UX3 values that differ only by case or spacing are shown once",()=>{
  const grouped=h.groupProducerValues([
    value("1","manufacturing_process","tubi saldati","https://a.it/1"),
    value("2","manufacturing_process","tubi  saldati"),
    value("3","manufacturing_process","Tubi Saldati"),
    value("4","manufacturing_process","TUBI SALDATI"),
    value("5","steel_grade","S235JRH"),
    value("6","steel_grade","S235JRH"),
    value("7","technical_standard","EN 10219-1"),
    value("8","technical_standard","EN 10219"),
  ]);
  assert.equal(grouped.length,4);
  const tubes=grouped.find(g=>g.kind==="manufacturing_process");
  assert.equal(tubes.occurrences,4);
  assert.equal(tubes.sourceUrl,"https://a.it/1","keeps the first source link");
  assert.notEqual(tubes.value,"TUBI SALDATI");
  // Different standards stay separate: grouping never merges distinct codes.
  assert.equal(grouped.filter(g=>g.kind==="technical_standard").length,2);
});

test("UX3 row highlights prefer documented values and cap at three",()=>{
  const documented=[
    value("a","steel_grade","S355J2H"),value("b","technical_standard","EN 10219"),
    value("c","manufacturing_process","Tubi saldati"),value("d","section_shape","RHS"),
    value("e","steel_grade","S275J0H"),
  ];
  const mentions=[value("m","technical_standard","EN 10305")];
  const out=h.producerHighlights(documented,mentions);
  assert.equal(out.shown.length,3);
  assert.equal(out.hidden,2);
  assert.equal(out.shown[0].value,"Tubi saldati","what the company makes comes first");
  assert.ok(!out.shown.some(v=>v.value==="EN 10305"),"mentions never mix with documented values");
  assert.equal(h.producerHighlights([],mentions).shown[0].value,"EN 10305","mentions fill only an empty row");
});

test("UX3 one search box: names stay a directory search, questions go to the AI",()=>{
  for(const name of ["EUROPIPE","Alessio Tubi","Acciaitubi","marcegaglia.com","ABS S.r.l.","Acciaierie Venete S.p.A.","Tubi"])
    assert.equal(h.isProducerTechnicalQuestion(name),false,name);
  for(const question of [
    "Chi produce tubi EN 10219 S355J2H?","Cerco tubi EN 10219 S355 RHS 200×100×6",
    "Produttori di tubi inox AISI 316 in Serbia","EN 10305-1","S355J2H","tubo 60,3x2,9",
    "quali aziende fanno lamiere","inox 304",
  ])assert.equal(h.isProducerTechnicalQuestion(question),true,question);
});

test("UX3 page: one header line, one search box, one disclosure for all cautions",()=>{
  assert.match(page,/data-testid="network-producers-header"/);
  assert.match(page,/<Form action="\/network\/pro\/producers" onSubmit=\{routeSearch\}/);
  assert.match(page,/if\(!isProducerTechnicalQuestion\(text\)\)return;\s*event\.preventDefault\(\);/);
  assert.match(page,/summary="Come leggere i dati"/);
  // Removed noise: repeated role line, three roadmap cards, second search heading.
  assert.doesNotMatch(page,/Ruolo produttore registrato/);
  assert.doesNotMatch(page,/Funzioni in arricchimento/);
  assert.doesNotMatch(page,/Cerca i produttori nel Network/);
  assert.doesNotMatch(page,/INCLUSO NEL MODULO PRODUTTORI/);
  // The chat no longer has its own input; it offers a way back to a name search.
  assert.doesNotMatch(chat,/<form onSubmit/);
  assert.match(chat,/Cerca invece come nome azienda/);
});

test("UX3 rows: check box comparison, Salva, details in a side panel",()=>{
  assert.match(page,/type="checkbox" checked=\{active\} disabled=\{!active&&selected\.length>=3\}/);
  assert.match(page,/<NetworkSaveToggle companyId=\{company\.id\}/);
  assert.match(page,/role="dialog" aria-modal="true" aria-labelledby="producer-detail-title"/);
  assert.match(page,/event\.key==="Escape"/);
  assert.match(page,/newRequestHref\(\{network:company\.id,fromNetwork:true\}\)/);
  assert.match(page,/groupProducerValues\(items\.filter\(item=>item\.kind===kind\)\)/);
  // The detail selection is scoped like the comparison: a new page never shows a stale panel.
  assert.match(page,/detail&&detail\.scope===selectionScope\?detail\.id:null/);
  assert.match(route,/getSavedNetworkCompanyIds\(context\.organizationId,ids\)/);
  assert.match(route,/savedIds=\{savedIds\}/);
  assert.doesNotMatch(route,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
