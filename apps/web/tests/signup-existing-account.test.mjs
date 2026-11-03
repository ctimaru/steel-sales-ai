import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/(italian)/login/actions.ts", import.meta.url), "utf8");
const signup = actions.slice(actions.indexOf("export async function signup("), actions.indexOf("export async function requestPasswordReset("));

test("a repeated signup of an existing account goes to sign-in, not to 'check your email'", () => {
  const signUp = signup.indexOf("supabase.auth.signUp(");
  const existing = signup.indexOf("data.user.identities.length === 0");
  const created = signup.indexOf('trackServerProductEvent("registration_account_created"');
  const verify = signup.indexOf('"/verify-email?sent=1&next="');
  assert.ok(signUp > 0 && existing > signUp && created > existing && verify > existing);
  assert.match(signup, /\(english \? "\/en\/login" : "\/login"\)/);
  assert.match(signup, /Esiste già un account con questa email\. Accedi qui sotto oppure usa «Password dimenticata»/);
  assert.match(signup, /"&next=" \+\s+encodeURIComponent\(nextPath\)/);
});
