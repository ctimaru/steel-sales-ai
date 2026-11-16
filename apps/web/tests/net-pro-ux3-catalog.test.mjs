import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ui=readFileSync(new URL("../components/network-pro-catalog.tsx",import.meta.url),"utf8");

test("NET-PRO-UX3 hero with real published totals and the viewer's access state",()=>{
  assert.match(ui,/data-testid="netpro-ux3-hero-stats"/);
  assert.match(ui,/coverage\.countries\.find\(row=>row\.countryCode==="IT"\)\?\.published\?\?0:null/);
  assert.match(ui,/value===null\?"—"/,"no estimate when coverage is unavailable");
  assert.match(ui,/access\.legacyFullNetwork\|\|activeModules\.length>0/);
  assert.match(ui,/data-testid="netpro-ux3-active-access"/);
  assert.doesNotMatch(ui,/🇮🇹|🇪🇺|line-clamp-3/);
});

test("NET-PRO-UX3 module cards: audience, example question, marginal package price, select all",()=>{
  assert.match(ui,/\{module\.audience\}/);
  assert.match(ui,/«\{module\.example\}»/);
  assert.match(ui,/networkProQuote\(\[\.\.\.selected,key\],territory,"monthly"\)\.monthlyBase/);
  assert.match(ui,/active\?"incluso":"\+ "\+euro\.format\(addPrice\(module\.key\)\)\+" \/ mese"/);
  assert.match(ui,/data-testid="netpro-ux3-select-all"/);
});

test("NET-PRO-UX3 summary stays honest: annual saving from the same quote, checkout still disabled",()=>{
  assert.match(ui,/quote\.monthlyBase\*12-quote\.annualTotal/);
  assert.match(ui,/description:"Checkout in arrivo"/);
  assert.match(ui,/disabled aria-disabled="true"/);
  assert.match(ui,/Nessun ordine o pagamento viene creato da questa schermata/);
});
