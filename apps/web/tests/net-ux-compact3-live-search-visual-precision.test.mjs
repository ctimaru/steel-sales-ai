import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const page=source("../components/network-compact-experience.tsx");
const live=source("../components/network-live-search.tsx");
const css=source("../app/globals.css");

test("COMPACT3.1 auto-search: debounce, keep focus, preserve filters, reset pagination",()=>{
  assert.match(page,/<NetworkLiveSearch filters=\{filters\}\s*\/>/);
  assert.match(live,/useEffect\(/);
  assert.match(live,/window\.setTimeout\(\(\)=>navigate\(draft\),350\)/);
  assert.match(live,/window\.clearTimeout\(handle\)/);
  assert.match(live,/router\.replace\(href,\{scroll:false\}\)/);
  assert.match(live,/document\.activeElement!==field\.current/);
  assert.match(live,/\["role","region","persona","product","capability","market","country"\]/);
  assert.match(live,/\/\/ Reset np to page 1/);
  assert.match(live,/onSubmit=\{submit\}/);
  assert.match(live,/const clear=\(\)=>/);
  assert.match(live,/aria-live="polite"/);
  assert.match(live,/onCompositionStart/);
});

test("COMPACT3.2 semantic buttons have legible primary / secondary text",()=>{
  assert.match(page,/ui-action-primary/);
  assert.match(page,/ui-action-secondary/);
  assert.match(live,/ui-action-primary/);
  assert.match(css,/\.ui-action-primary \{/);
  assert.match(css,/color: #ffffff !important/);
  assert.match(css,/\.ui-action-secondary \{/);
  assert.match(css,/color: var\(--brand-deep\) !important/);
  assert.doesNotMatch(page,/className="app-secondary inline-flex/);
  assert.doesNotMatch(page,/className="app-primary inline-flex/);
});

test("COMPACT3.3 uses built-in vector flags rather than OS emoji rendering",()=>{
  const flags=source("../components/network-country-flag.tsx");
  for(const country of ["IT","DE","FR","ES","US","GB","CH"]){
    assert.match(flags,new RegExp('case "'+country+'":'));
  }
  assert.match(flags,/viewBox=/);
  assert.match(flags,/<FlagShapes country=/);
  assert.match(flags,/country==="CH"/);
  assert.match(page,/countryCode=\(company.country_code\|\|""\).toUpperCase\(\)/);
  assert.equal((page.match(/<NetworkCountryFlag code=\{countryCode\}\/>/g)||[]).length,2,
    "country icon must appear in both desktop and compact/mobile layouts");
  assert.match(page,/countryLabel/);
  assert.match(page,/company.location\?\.city/);
  assert.match(page,/Sede non indicata/);
  assert.doesNotMatch(page,/nation.flag/);
});

test("COMPACT3.4 desktop header and rows use one column contract; mobile remains compact",()=>{
  assert.match(page,/const COMPANY_COLUMNS=/);
  const n=(page.match(/\+COMPANY_COLUMNS/g)||[]).length;
  assert.equal(n,2,"header and rows must share the same columns");
  assert.match(page,/lg:grid-cols-\[minmax\(210px/);
  assert.match(page,/grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(page,/sm:grid-cols-\[repeat\(4,minmax\(0,1fr\)\)_auto\]/);
  assert.match(page,/w-full min-w-0 rounded-lg border/);
  assert.match(page,/aria-label="Pagina successiva"/);
  assert.match(page,/min-h-10 w-full/);
});
