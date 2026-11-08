import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const detail=readFileSync(new URL("../app/(italian)/(workspace)/network/[id]/page.tsx",import.meta.url),"utf8");

test("GROWTH9: every company card has clear email and telephone fields",()=>{
  assert.match(detail,/data-testid="network-profile-header-contact"/);
  assert.match(detail,/network-company-public-email/);
  assert.match(detail,/network-company-public-phone/);
  assert.match(detail,/network-company-email-unavailable/);
  assert.match(detail,/network-company-phone-unavailable/);
  assert.match(detail,/Contatti aziendali/);
  assert.match(detail,/Da integrare/);
});

test("GROWTH9: fields use only privacy-filtered profile contacts, no invented data",()=>{
  assert.match(detail,/profile\.contacts\.find\(\(contact\) => contact\.email\)/);
  assert.match(detail,/profile\.contacts\.find\(\(contact\) => contact\.phone\)/);
  assert.match(detail,/emailContact\?\.email/);
  assert.match(detail,/phoneContact\?\.phone/);
  assert.match(detail,/revisione privacy/);
  assert.doesNotMatch(detail,/headerContact \?/);
});
