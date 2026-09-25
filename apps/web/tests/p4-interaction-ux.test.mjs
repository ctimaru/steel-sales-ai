import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/network/actions.ts", import.meta.url),
  "utf8",
);
const profile = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url),
  "utf8",
);
const compose = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/inquiry/page.tsx", import.meta.url),
  "utf8",
);
const inbox = fs.readFileSync(
  new URL("../app/(workspace)/network/inquiries/page.tsx", import.meta.url),
  "utf8",
);
const manage = fs.readFileSync(
  new URL("../app/(workspace)/network/manage/page.tsx", import.meta.url),
  "utf8",
);
const networkLib = fs.readFileSync(
  new URL("../lib/network.ts", import.meta.url),
  "utf8",
);

test("P4.5 company profile only exposes inquiry CTA through eligibility", () => {
  assert.match(profile, /getInquiryEligibility/);
  assert.match(profile, /inquiryEligible/);
  assert.match(profile, /Invia inquiry/);
  assert.match(compose, /p4 · Interaction Layer|Business inquiry/i);
  assert.match(compose, /eligibility\.eligible/);
});

test("P4.5 compose and inbox use controlled inquiry RPC actions", () => {
  assert.match(actions, /p4_submit_inquiry/);
  assert.match(actions, /p4_transition_inquiry/);
  assert.match(actions, /p4_report_inquiry/);
  assert.match(inbox, /Ricevute/);
  assert.match(inbox, /Inviate/);
  assert.match(inbox, /Blocca organizzazione mittente/);
  assert.match(networkLib, /p4_list_inquiries/);
});

test("P4.5 claimed-company admin can control inquiry receiving preference", () => {
  assert.match(manage, /Ricezione inquiry/);
  assert.match(manage, /setInquiryPreferences/);
  assert.match(actions, /p4_set_inquiry_preferences/);
  assert.match(networkLib, /p4_get_inquiry_preferences/);
});

test("P4.5 remains an inquiry workflow rather than native messaging", () => {
  assert.doesNotMatch(compose, /websocket|realtime|typing indicator/i);
  assert.match(compose, /non crea una connection pubblica/);
  assert.match(inbox, /Interazioni B2B private tra organizzazioni/);
});
