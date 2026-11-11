import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const profile=read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const overview=read("../components/network-profile-overview.tsx");

test("GROWTH9: available company channels are visible immediately, without empty field clutter",()=>{
  assert.match(profile,/<NetworkProfileOverview/);
  assert.match(overview,/data-testid="network-profile-header-contact"/);
  assert.match(overview,/data-testid="network-company-public-email"/);
  assert.match(overview,/data-testid="network-company-public-phone"/);
  assert.match(overview,/Contatti/);
  assert.match(overview,/Sito ufficiale/);
  assert.doesNotMatch(overview,/Da integrare|network-company-email-unavailable|network-company-phone-unavailable/);
});

test("GROWTH9: contact fields come only from privacy-reviewed public profile data",()=>{
  assert.match(profile,/profile\.contacts\.find\(\(contact\) => contact\.email\)/);
  assert.match(profile,/profile\.contacts\.find\(\(contact\) => contact\.phone\)/);
  assert.match(profile,/email=\{emailContact\?\.email\}/);
  assert.match(profile,/phone=\{phoneContact\?\.phone\}/);
  assert.match(overview,/email \?/);
  assert.match(overview,/phone \?/);
  assert.doesNotMatch(overview,/sample@|example@|commerciale@asgspa/);
});
