import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const finder=read("../components/calculator-dimension-discovery.tsx");
const css=read("../components/calculator-dense-cockpit.module.css");
const workflow=read("../../.github/workflows/perf2-1-mobile-acceptance.yml");
test("DENSE1R-D: five-language compact suggestions float, never reflow cockpit",()=>{
  const parsed=ts.transpileModule(finder,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});
  assert.equal(parsed.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
  for(const key of ['role="combobox"','role="listbox"','role="option"','data-dense-discovery-popover','absolute left-0 top-[calc(100%+6px)]',
    'event.key==="ArrowDown"','event.key==="ArrowUp"','event.key==="Escape"','setExpandedResults(false)','compact={compact}'])
    assert.ok(finder.includes(key),key);
  for(const lang of ["it","en","de","fr","es"])assert.ok(finder.includes(lang+":{"),lang);
  for(const blocked of ["fetch(","supabase","sessionStorage","localStorage"])
    assert.ok(!finder.includes(blocked),"No backend/persistent data on dimension discovery: "+blocked);
  assert.match(css,/never reflow/);
  assert.match(workflow,/calc-dense1r-d-chrome-discovery/);
});
