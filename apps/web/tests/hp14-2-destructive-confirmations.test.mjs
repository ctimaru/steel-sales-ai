import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const confirmButton = read("../components/confirm-submit-button.tsx");
const marketplace = read("../components/marketplace-response-workspace.tsx");
const people = read("../app/(platform)/platform/people/page.tsx");
const claims = read("../app/(platform)/platform/company-claims/page.tsx");
const registration = read("../app/(platform)/platform/registrations/[id]/page.tsx");
const networkTrust = read("../app/(platform)/platform/network-trust/page.tsx");

test("HP14.2 defines one accessible confirmation modal contract", () => {
  assert.match(confirmButton, /export function ConfirmSubmitButton/);
  assert.match(confirmButton, /role="alertdialog"/);
  assert.match(confirmButton, /aria-modal="true"/);
  assert.match(confirmButton, /aria-labelledby=\{titleId\}/);
  assert.match(confirmButton, /aria-describedby=\{descriptionId\}/);
  assert.match(confirmButton, /aria-haspopup="dialog"/);
  assert.match(confirmButton, /event\.key === "Escape"/);
  assert.match(confirmButton, /requestSubmit\(submitter\)/);
  assert.match(confirmButton, /useFormStatus/);
});

test("HP14.2 protects destructive and externally visible Marketplace transitions", () => {
  assert.match(marketplace, /title="Rimuovere questa linea dalla risposta\?"/);
  assert.match(marketplace, /formAction=\{removeMarketplaceResponseLine\}/);
  assert.match(marketplace, /title="Inviare la risposta al buyer\?"/);
  assert.match(marketplace, /title="Ritirare questa bozza\?"/);
  assert.match(marketplace, /title="Ritirare la risposta inviata\?"/);
});

test("HP14.2 protects Platform access lifecycle revocations", () => {
  assert.match(people, /title="Sospendere questo account Platform Staff\?"/);
  assert.match(people, /title="Revocare definitivamente questo account\?"/);
  assert.match(people, /title="Revocare questo invito\?"/);
  assert.match(people, /confirmLabel="Revoca definitivamente"/);
});

test("HP14.2 protects company claim rejection and ownership revocation", () => {
  assert.match(claims, /title="Rifiutare questa prova di ownership\?"/);
  assert.match(claims, /title="Rifiutare questo company claim\?"/);
  assert.match(claims, /title="Revocare il controllo di questo profilo\?"/);
  assert.match(claims, /name="decision"/);
  assert.match(claims, /value="revoked"/);
});

test("HP14.2 protects registration rejection and entity-creating activation", () => {
  assert.match(registration, /title="Rifiutare questa richiesta di registrazione\?"/);
  assert.match(registration, /title="Approvare e attivare questa registrazione\?"/);
  assert.match(registration, /title="Approvare e attivare il workspace\?"/);
  assert.match(registration, /title="Attivare con questa identità Network\?"/);
  assert.match(registration, /title="Attivare workspace e nuovo profilo Network\?"/);
});

test("HP14.2 protects Network verification revocation", () => {
  assert.match(networkTrust, /title="Revocare questa Network verification\?"/);
  assert.match(networkTrust, /confirmLabel="Revoca verification"/);
});
