/**
 * CALC-INT3E.5 — production HTTPS public funnel availability, GET ONLY.
 * Does not pretend to validate consented custom events or signups.
 * No login, form submit, mutation, clipboard, analytics opt-in, or RFQ send.
 */
import assert from "node:assert/strict";
const BASE="https://www.smartsteelsales.com";
const cases=[
  {locale:"en",bill:"/en/distinta",calculator:"/en/knowledge/tubes",
    title:"Create a steel RFQ bill of materials in English."},
  {locale:"de",bill:"/de/distinta",calculator:"/de/knowledge/tubes",
    title:"Stahlrohr-Stückliste für Angebotsanfragen kostenlos erstellen"},
  {locale:"fr",bill:"/fr/distinta",calculator:"/fr/knowledge/tubes",
    title:"Créer une liste de demande de prix pour tubes acier"},
  {locale:"es",bill:"/es/distinta",calculator:"/es/knowledge/tubes",
    title:"Crear lista de materiales para solicitar ofertas de tubos de acero"},
];
const paths=[...new Set([...cases.flatMap(c=>[c.bill,c.calculator]),"/en/register"])];
for(const path of paths){
  const url=new URL(path,BASE);
  assert.equal(url.hostname,"www.smartsteelsales.com");
  const response=await fetch(url,{
    method:"GET",redirect:"manual",cache:"no-store",
    headers:{"accept":"text/html","user-agent":"SmartSteelSales-CALC-INT3E5-ReadOnly/1.0"},
    signal:AbortSignal.timeout(30000),
  });
  assert.equal(response.status,200,"Public production GET "+path);
  assert.match(response.headers.get("content-type")||"",/text\/html/i);
  const text=await response.text();
  assert.ok(text.length<5_000_000,"Unexpected payload size "+path);
  const page=cases.find(c=>c.bill===path);
  if(page){
    assert.ok(text.includes(page.title),"Missing localized bill H1: "+path);
    assert.ok(text.includes(BASE+page.bill),"Missing canonical: "+path);
    assert.match(text,new RegExp('<html[^>]*lang="'+page.locale+'"'),"Incorrect document language: "+path);
    for(const lang of ["it","en","de","fr","es"]){
      assert.ok(text.includes('hrefLang="'+lang+'"')||
        text.includes('hreflang="'+lang+'"'),
        "Missing "+lang+" reciprocal hreflang on "+path);
    }
    assert.match(text,/\/en\/register/,"No registration route found on "+path);
    assert.ok(!text.includes("sendSupplierEmail("),"Server render must not contain RFQ dispatch");
  }else if(path!=="/en/register"){
    assert.ok(text.includes('id="calcolatore-pesi"') || /weight|Gewicht|poids|peso/i.test(text),
      "Missing calculator "+path);
  }
  console.log("CALC-INT3E.5 PRODUCTION READ ONLY PASS",path,response.status,
    "anonymous GET, no writes");
}
console.log("CALC-INT3E.5 NOTE: real consented event delivery and attribution require private dashboard/traffic evidence; this test confirms public routes only.");
