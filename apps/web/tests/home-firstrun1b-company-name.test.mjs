import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const identitySource = read("../lib/workspace-identity.ts");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const checklist = read("../components/workspace-first-run-checklist.tsx");
const onboarding = read("../app/(italian)/onboarding/page.tsx");

const compiled = ts.transpileModule(identitySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sandbox = { exports: {}, module: { exports: {} }, Intl, Number };
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(compiled, sandbox);
const { organizationNameMatchesPerson, workspaceGreeting } = sandbox.exports;

test("HOME-FIRSTRUN1B flags a workspace named exactly after the registrant", () => {
  assert.equal(organizationNameMatchesPerson("Claudio Timaru", "Claudio Timaru"), true);
  assert.equal(organizationNameMatchesPerson("timaru claudio", "Claudio  Timaru"), true, "order and case insensitive");
  assert.equal(organizationNameMatchesPerson("Nicolò Bianchi", "Nicolo Bianchi"), true, "accents ignored");
});

test("HOME-FIRSTRUN1B never flags real company names or weak signals", () => {
  assert.equal(organizationNameMatchesPerson("Rossi Tubi S.r.l.", "Mario Rossi"), false);
  assert.equal(organizationNameMatchesPerson("Mario Rossi S.r.l.", "Mario Rossi"), false, "legal form present");
  assert.equal(organizationNameMatchesPerson("Mario Rossi S.p.A.", "Mario Rossi"), false);
  assert.equal(organizationNameMatchesPerson("Acciai Speciali Terni", "Claudio Timaru"), false);
  assert.equal(organizationNameMatchesPerson("Mario", "Mario"), false, "single word is too weak");
  assert.equal(organizationNameMatchesPerson("Claudio Timaru", null), false);
  assert.equal(organizationNameMatchesPerson(null, "Claudio Timaru"), false);
});

test("HOME-FIRSTRUN1B greeting follows Europe/Rome time of day", () => {
  // 3 Nov 2026 is CET (UTC+1).
  assert.equal(workspaceGreeting(new Date("2026-11-03T08:00:00Z")), "Buongiorno"); // 09:00
  assert.equal(workspaceGreeting(new Date("2026-11-03T16:59:00Z")), "Buongiorno"); // 17:59
  assert.equal(workspaceGreeting(new Date("2026-11-03T17:00:00Z")), "Buonasera"); // 18:00
  assert.equal(workspaceGreeting(new Date("2026-11-03T02:00:00Z")), "Buonasera"); // 03:00
  assert.equal(workspaceGreeting(new Date("2026-11-03T10:00:00Z"), "Not/AZone"), "Buongiorno", "invalid zone falls back to UTC");
});

test("HOME-FIRSTRUN1B Home title names the company and the hint is admin-only, first-access-only", () => {
  assert.match(home, /<h1[^>]*>\s*\{workspaceGreeting\(\)\}, \{context\.organizationName\}\s*<\/h1>/);
  assert.match(home, /const registrantNamePromise = isAdmin \? loadOwnRegistrationContactName\(\) : Promise\.resolve\(null\)/);
  assert.match(home, /\.from\("company_registration_applications"\)\s*\.select\("contact_name"\)/);
  assert.match(home, /firstRun\.active && organizationNameMatchesPerson\(context\.organizationName, registrantName\)/);
  assert.match(home, /appRoutes\.company\.setup \+ "#company-name"/);
  // The main parallel batch stays one Promise.all (HP16 perceived-speed contract).
  assert.match(home, /\[setup, commercial, procurement, pulse, feedPage, suggestions\] = await Promise\.all/);
});

test("HOME-FIRSTRUN1B hint copy respects ditte individuali and links to the existing name field", () => {
  assert.match(checklist, /Se sei una ditta individuale va bene così/);
  assert.match(checklist, /role="note"/);
  assert.match(checklist, /data-testid="workspace-company-name-hint"/);
  assert.match(onboarding, /id="company-name"\s*name="name"/);
});
