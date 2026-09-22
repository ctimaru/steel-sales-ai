import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/review/identities/actions.ts", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(workspace)/review/identities/page.tsx", import.meta.url),
  "utf8",
);
const form = fs.readFileSync(
  new URL("../components/identity-confirm-form.tsx", import.meta.url),
  "utf8",
);

test("identity confirmation uses the controlled workflow RPC", () => {
  assert.match(actions, /confirm_contact_company_mapping/);
  assert.match(actions, /p_contact_id/);
  assert.match(actions, /p_company_id/);
  assert.match(actions, /identity_confirmation_ui/);
});

test("identity review surface forbids domain inference and shows only verified companies", () => {
  assert.match(page, /Company già verificate/);
  assert.match(page, /dominio email non viene mai usato/);
  assert.match(page, /La selezione è sempre manuale/);
  assert.doesNotMatch(page, /suggerit[ao]|consigliat[ao]/i);
});

test("successful identity confirmation refreshes related commercial surfaces", () => {
  assert.match(actions, /revalidatePath\("\/review\/identities"\)/);
  assert.match(actions, /revalidatePath\("\/review"\)/);
  assert.match(actions, /revalidatePath\("\/search"\)/);
  assert.match(actions, /revalidatePath\("\/dashboard"\)/);
  assert.match(actions, /revalidatePath\("\/customers"\)/);
  assert.match(actions, /revalidatePath\(`\/customers\/\$\{companyId\}`\)/);
  assert.match(form, /Apri Company 360/);
  assert.match(form, /\/customers\/\$\{state\.companyId\}/);
});
