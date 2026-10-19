import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const free=read("../components/free-network-profile.tsx");
const pro=read("../app/(italian)/(workspace)/network/[id]/page.tsx");

test("NET-PROFILE1G: the first screen centers company identity and real connection action",()=>{
  for(const profile of [free,pro]){
    assert.match(profile,/Profilo aziendale/);
    assert.match(profile,/break-words text-2xl/);
    assert.match(profile,/app-primary/);
    assert.match(profile,/Richiedi connessione/);
    assert.match(profile,/max-w-6xl/);
    assert.ok(profile.indexOf("Richiedi connessione") < profile.indexOf("Rappresenti questa azienda?"),
      "connection should precede claim");
  }
  assert.ok(free.indexOf('aria-label="Connessione aziendale"') < free.indexOf('aria-label="Informazioni aziendali con fonte"'),
    "important action belongs in first screen, ahead of long evidence");
});

test("NET-PROFILE1G: source provenance and provisional recipient guards remain visible",()=>{
  assert.match(free,/Origine e attendibilità delle informazioni/);
  assert.match(free,/Vedi fonte aziendale/);
  assert.match(free,/reviewedEvidence\.map/);
  assert.match(free,/provisional\?"unavailable"/);
  assert.match(free,/status==="available"&&canConnect/);
  assert.match(free,/non è possibile inviare richieste/);
  assert.match(pro,/inquiryEligible && canInteract/);
  assert.match(pro,/safeNetworkWebsiteUrl\(profile.company.website_url\)/);
});

test("NET-PROFILE1G: clean trustworthy cards, not empty claims or obsolete hardcoded status pills",()=>{
  assert.doesNotMatch(pro,/Profilo non rivendicato|Azienda non verificata|Technical scope|Commercial snapshot/);
  assert.doesNotMatch(pro,/text-\[#92a0b1\]|text-\[#87938e\]|text-\[#8a98aa\]/);
  assert.match(pro,/\["unclaimed", "revoked"\]\.includes\(profile.company.claimed_status\) &&/);
  assert.match(free,/profile.products.length>0 \|\| profile.facilities.length>0/);
  assert.match(free,/sm:grid-cols-2/);
  assert.match(pro,/sm:grid-cols-2/);
});
