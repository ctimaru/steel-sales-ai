import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const get=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const ui=get("components/network-pro-catalog.tsx");
const catalog=get("lib/network-pro-catalog.ts");
const page=get("app/(italian)/(workspace)/network/pro/page.tsx");
const browser=get("tests/net-pro-catalog1b-chrome.mjs");

test("NETPRO-DESIGN1: approved one-page desktop/mobile checkout layout",()=>{
  assert.match(ui,/Sblocca i contatti industriali che ti servono/);
  assert.match(ui,/1\. Seleziona/);
  assert.match(ui,/2\. Paga/);
  assert.match(ui,/3\. Accedi subito/);
  assert.match(ui,/aria-label="Copertura geografica"/);
  assert.match(ui,/aria-label="Periodicità abbonamento"/);
  assert.match(ui,/lg:grid-cols-\[minmax\(0,1fr\)_350px\]/);
  assert.match(ui,/lg:sticky lg:top-24/);
  assert.match(ui,/data-testid="netpro-design1-mobile-checkout"/);
  assert.match(ui,/fixed inset-x-0 bottom-0/);
  assert.match(ui,/safe-area-inset-bottom/);
  assert.match(ui,/data-testid="network-pro-mobile-price"/);
  assert.match(ui,/data-testid="netpro-design1-mobile-pay"/);
  assert.match(ui,/aria-pressed=\{active\}/);
  assert.match(ui,/aria-expanded=\{coverageExpanded\}/);
  assert.match(ui,/data-testid="netpro-design1-toggle-country-details"/);
  assert.match(browser,/getComputedStyle\(el\)\.position/);
  assert.match(browser,/1440,390,320/);
});

test("NETPRO-DESIGN1: selectable modules use actual industry roles and verified published coverage",()=>{
  for(const key of ["producers","distributors","processors","end_users"]){
    assert.match(ui,new RegExp('"'+key+'"'));
    assert.match(catalog,new RegExp('key: "'+key+'"'));
  }
  assert.match(ui,/const publishedInTerritory = coverage/);
  assert.match(ui,/countries\.reduce\(\(total, country\) => total \+ country\.publishedModules\[module\.key\], 0\)/);
  assert.match(ui,/country\.publishedModules\[module\.key\]/);
  assert.match(ui,/country\.provisionalModules\[module\.key\]/);
  assert.match(ui,/Copertura pubblicata non disponibile/);
  assert.match(ui,/non sono incluse nei numeri/);
  assert.doesNotMatch(ui,/7\.240|3\.129|5\.876|12\.698|16\.245|80\.000/);
  assert.match(page,/getNetworkProCoverage/);
  assert.match(page,/getNetworkProAccess/);
});

test("NETPRO-DESIGN1: proposed prices are never fake tax calculations or an imaginary payment",()=>{
  assert.match(ui,/networkProQuote\(selected,territory,billing\)/);
  assert.match(ui,/quote\.displayedTotal/);
  assert.match(ui,/quote\.monthlyBase/);
  assert.match(ui,/Imposte/);
  assert.match(ui,/Calcolate al checkout/);
  assert.doesNotMatch(ui,/IVA \(22%\)|0\.22\b|paymentIntent|stripe\.com/i);
  assert.match(catalog,/purchasable: false as const/);
  assert.match(ui,/Nessun ordine o pagamento viene creato/);
  assert.match(ui,/disabled aria-disabled="true"/);
  assert.match(ui,/Abbonati e sblocca/);
  assert.doesNotMatch(ui,/startNetworkProCheckout|openNetworkProCustomerPortal/);
});
