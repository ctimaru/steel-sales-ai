import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const ui=read("../components/network-compact-experience.tsx");
const profile=read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const overview=read("../components/network-profile-overview.tsx");

test("NET-CONN3 list: non-active companies show a disabled Connetti, never a link",()=>{
  assert.match(ui,/data-testid="network-row-connect-disabled"/);
  assert.match(ui,/role="button" aria-disabled="true"/);
  assert.match(ui,/Connetti sarà disponibile quando l’azienda sarà attiva sulla piattaforma/);
  const disabled=ui.slice(ui.indexOf("function DisabledConnect"),ui.indexOf("function ContactCell"));
  assert.doesNotMatch(disabled,/href=/,"the disabled button must not navigate to /connect");
});

test("NET-CONN3 list: only SQL 'unavailable', only for roles that can act, never for discovered records",()=>{
  assert.match(ui,/if\(status==="unavailable"&&canAct&&!company\.discovery_status\)return <DisabledConnect/);
  assert.match(ui,/if\(status==="available"\)return <Link href=\{"\/network\/"\+company\.id\+"\/connect"\}/);
  assert.match(ui,/canAct=\{canCompose\}/);
  // Email-reachable companies keep their label under the disabled button.
  assert.match(ui,/<DisabledConnect name=\{name\} emailReachable=\{emailReachable\}\/>/);
});

test("NET-CONN3 profile: only eligible recipients get an active connection action",()=>{
  assert.match(profile,/inquiryEligible && canInteract/);
  assert.match(profile,/getInquiryEligibility\(organizationId, profile.company.id\)/);
  assert.match(profile,/inquiryReason !== "self_inquiry"|inquiryEligible && canInteract/);
  assert.doesNotMatch(profile,/data-testid="network-profile-connect-disabled"/);
  assert.doesNotMatch(profile,/Connessione nella piattaforma non disponibile/);
  assert.match(overview,/Sito aziendale/);
});
