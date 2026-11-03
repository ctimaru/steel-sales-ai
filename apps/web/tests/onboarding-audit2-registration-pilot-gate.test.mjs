import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const transpile = (source) => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText;
const toUri = (code) => "data:text/javascript;base64," + Buffer.from(code).toString("base64");

const legalUri = toUri(transpile(read("../lib/legal.ts")));
const accessSource = read("../lib/registration-access.ts");
const access = await import(toUri(
  transpile(accessSource.replace(/^import "server-only";\s*/mu, ""))
    .replace('from "@/lib/legal"', `from "${legalUri}"`),
));

const signupActions = read("../app/(italian)/login/actions.ts");
const registerActions = read("../app/(italian)/register/actions.ts");
const itRegister = read("../app/(italian)/register/page.tsx");
const enRegister = read("../app/(english)/en/register/page.tsx");
const homeTrust = read("../components/public-registration-trust.tsx");

const ENV_KEYS = [
  "VERCEL_ENV",
  "REGISTRATION_ACCESS_MODE",
  "REGISTRATION_PILOT_ALLOWLIST",
  "NEXT_PUBLIC_LEGAL_CONTROLLER_NAME",
  "NEXT_PUBLIC_LEGAL_CONTROLLER_ADDRESS",
  "NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL",
];
function withEnv(values, fn) {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  try { return fn(); } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}
const CONTROLLER = {
  NEXT_PUBLIC_LEGAL_CONTROLLER_NAME: "Example S.r.l.",
  NEXT_PUBLIC_LEGAL_CONTROLLER_ADDRESS: "Via Esempio 1, Milano",
  NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL: "privacy@example.com",
};

test("F1 gate is active in production while the controller identity is missing", () => {
  withEnv({ VERCEL_ENV: "production" }, () => {
    assert.equal(access.registrationPilotGateActive(), true);
    assert.equal(access.registrationAllowedFor("someone@acme.it"), false);
  });
});

test("F1 gate turns off automatically once the controller identity is configured", () => {
  withEnv({ VERCEL_ENV: "production", ...CONTROLLER }, () => {
    assert.equal(access.registrationPilotGateActive(), false);
    assert.equal(access.registrationAllowedFor("someone@acme.it"), true);
  });
});

test("F1 gate is inactive locally and in CI unless pilot mode is requested", () => {
  withEnv({}, () => assert.equal(access.registrationPilotGateActive(), false));
  withEnv({ VERCEL_ENV: "preview" }, () => assert.equal(access.registrationPilotGateActive(), false));
  withEnv({ REGISTRATION_ACCESS_MODE: "pilot_invite" }, () =>
    assert.equal(access.registrationPilotGateActive(), true));
});

test("F1 allowlist matches exact emails and @domain entries, case-insensitively", () => {
  withEnv({
    VERCEL_ENV: "production",
    REGISTRATION_PILOT_ALLOWLIST: "Mario.Rossi@Acciai.it, @tubiferro.it;ops@example.com",
  }, () => {
    assert.equal(access.registrationAllowedFor("mario.rossi@acciai.it"), true);
    assert.equal(access.registrationAllowedFor(" MARIO.ROSSI@ACCIAI.IT "), true);
    assert.equal(access.registrationAllowedFor("anna@tubiferro.it"), true);
    assert.equal(access.registrationAllowedFor("ops@example.com"), true);
    assert.equal(access.registrationAllowedFor("luigi@acciai.it"), false);
    assert.equal(access.registrationAllowedFor("anna@sub.tubiferro.it"), false);
    assert.equal(access.registrationAllowedFor("anna@tubiferro.it.evil.com"), false);
    assert.equal(access.registrationAllowedFor(""), false);
    assert.equal(access.registrationAllowedFor(null), false);
    assert.equal(access.registrationAllowedFor("@tubiferro.it"), false);
  });
});

test("F1 gate is fail-closed: an empty allowlist admits nobody", () => {
  withEnv({ VERCEL_ENV: "production", REGISTRATION_PILOT_ALLOWLIST: " , ;" }, () => {
    assert.equal(access.registrationAllowedFor("anyone@acme.it"), false);
  });
});

test("F1 allowlist stays server-only", () => {
  assert.match(accessSource, /^import "server-only";/m);
  assert.doesNotMatch(accessSource, /NEXT_PUBLIC_REGISTRATION/);
});

test("F1 signup refuses non-invited emails before any account is created", () => {
  const gate = signupActions.indexOf("registrationAllowedFor(email)");
  const signUp = signupActions.indexOf("supabase.auth.signUp(");
  assert.ok(gate > 0 && signUp > gate, "pilot gate runs before supabase.auth.signUp");
});

test("F1 company submission is gated before legal acceptance is recorded", () => {
  const gate = registerActions.indexOf("registrationAllowedFor(user.email)");
  const legal = registerActions.indexOf('"lr5_record_legal_acceptance"');
  const insert = registerActions.indexOf(".insert(payload)");
  assert.ok(gate > 0 && legal > gate && insert > gate);
  assert.match(registerActions, /\.eq\("application_status", "needs_information"\)/);
});

test("F1 registration pages explain the pilot and hide the company form for non-invited users", () => {
  for (const page of [itRegister, enRegister]) {
    assert.match(page, /registrationPilotGateActive\(\)/);
    assert.match(page, /pilotEmailAllowed\(user\.email\)/);
    assert.match(page, /RegistrationPilotNotice[^>]*blocking/);
    assert.match(page, /pilotBlocked \? null :/);
  }
  assert.match(homeTrust, /registrationPilotGateActive\(\)/);
  assert.match(homeTrust, /la registrazione è solo su invito/);
});
