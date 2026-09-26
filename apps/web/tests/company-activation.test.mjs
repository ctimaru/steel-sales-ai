import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const identityActions = fs.readFileSync(
  new URL("../app/(workspace)/review/identities/actions.ts", import.meta.url),
  "utf8",
);
const identityForm = fs.readFileSync(
  new URL("../components/identity-confirm-form.tsx", import.meta.url),
  "utf8",
);
const customerActions = fs.readFileSync(
  new URL("../app/(workspace)/customers/actions.ts", import.meta.url),
  "utf8",
);
const customers = fs.readFileSync(
  new URL("../app/(workspace)/customers/page.tsx", import.meta.url),
  "utf8",
);
const company360 = fs.readFileSync(
  new URL("../app/(workspace)/customers/[companyId]/page.tsx", import.meta.url),
  "utf8",
);
const search = fs.readFileSync(
  new URL("../components/global-search.tsx", import.meta.url),
  "utf8",
);

test("identity confirmation immediately refreshes and opens Company 360", () => {
  assert.match(identityActions, /revalidatePath\("\/customers"\)/);
  assert.match(identityActions, /revalidatePath\(\`\/customers\/\$\{companyId\}\`\)/);
  assert.match(identityActions, /companyId,/);
  assert.match(identityForm, /\/customers\/\$\{state\.companyId\}/);
  assert.match(identityForm, /Apri Company 360/);
});

test("customer surfaces expose the controlled unresolved identity count", () => {
  assert.match(customerActions, /p1_identity_confirmation_queue/);
  assert.match(customerActions, /unresolved_contacts/);
  assert.match(customers, /identità aziendali da confermare/);
  assert.match(customers, /Contact→Company esplicita/);
  assert.match(customers, /appRoutes\.operations\.reviewIdentities/);
  assert.match(company360, /activation\.unresolvedContacts/);
  assert.match(company360, /identità in attesa di conferma/);
});

test("global search only opens Company 360 from explicit company_id metadata", () => {
  assert.match(search, /result\.metadata\?\.company_id/);
  assert.match(search, /appRoutes\.commercial\.company\(companyId\)/);
  assert.match(search, /Apri azienda →/);
  assert.doesNotMatch(search, /domain.*companyTarget/i);
});
