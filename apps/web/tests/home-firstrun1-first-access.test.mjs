import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const logicSource = read("../lib/workspace-first-run.ts");
const checklist = read("../components/workspace-first-run-checklist.tsx");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");

const compiled = ts.transpileModule(logicSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sandbox = { exports: {}, module: { exports: {} } };
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(compiled, sandbox);
const { deriveWorkspaceFirstRun } = sandbox.exports;

const routes = { profile: "/company/profile", memory: "/onboarding", firstValue: "/operations/uploads", team: "/company/team" };
const freshSetup = {
  profile_ready: true,
  data_ready: false,
  first_value_ready: false,
  team_ready: false,
  setup_completed: false,
  essential_completed_count: 1,
  essential_total_count: 2,
};
const derive = (overrides = {}, setup = freshSetup) =>
  deriveWorkspaceFirstRun({ setup, commercialRecords: 0, ...overrides }, routes);

test("HOME-FIRSTRUN1 a brand-new company (1/2) is first access with Commercial Memory as next step", () => {
  const state = derive();
  assert.equal(state.active, true);
  assert.equal(state.reason, "setup_incomplete");
  assert.equal(state.nextStep.id, "memory");
  assert.equal(state.nextStep.href, "/onboarding");
  assert.equal(state.essentialCompleted, 1);
  assert.equal(state.essentialTotal, 2);
  assert.deepEqual(Array.from(state.steps, (step) => step.id), ["profile", "memory", "first_value", "team"]);
});

test("HOME-FIRSTRUN1 profile comes first when nothing is ready", () => {
  const state = derive({}, { ...freshSetup, profile_ready: false, essential_completed_count: 0 });
  assert.equal(state.nextStep.id, "profile");
  assert.equal(state.nextStep.href, "/company/profile");
});

test("HOME-FIRSTRUN1 setup done but no first document still guides to the import", () => {
  const state = derive({}, { ...freshSetup, data_ready: true, setup_completed: true, essential_completed_count: 2 });
  assert.equal(state.active, true);
  assert.equal(state.reason, "no_first_document");
  assert.equal(state.nextStep.id, "first_value");
});

test("HOME-FIRSTRUN1 never activates for non-admins, complete companies or companies already working", () => {
  assert.equal(derive({}, null).active, false, "members/viewers have no setup state");
  assert.equal(
    derive({}, { ...freshSetup, data_ready: true, first_value_ready: true, setup_completed: true, essential_completed_count: 2 }).active,
    false,
  );
  assert.equal(derive({ commercialRecords: 3 }).active, false, "live commercial records");
  assert.equal(derive({ activeRfqs: 1 }).active, false, "active RFQs");
  assert.equal(derive({ attentionTotal: 2 }).active, false, "buyer actions");
});

test("HOME-FIRSTRUN1 ignores malformed counters and never makes the optional team step blocking", () => {
  assert.equal(derive({ activeRfqs: "5", attentionTotal: Number.NaN }).active, true);
  const onlyTeamMissing = derive({}, { ...freshSetup, data_ready: true, first_value_ready: true, setup_completed: false, essential_completed_count: 2 });
  assert.equal(onlyTeamMissing.active, false, "nothing actionable but team: normal Home");
  const clamped = derive({}, { ...freshSetup, essential_completed_count: 9, essential_total_count: 2 });
  assert.equal(clamped.essentialCompleted, 2);
});

test("HOME-FIRSTRUN1 Home wires the checklist at the top of the overview and demotes, not removes, the assistant", () => {
  // HOME-FEED1 (founder decision, 4 Nov 2026): Home is a three-column feed; superseded layout checks rewritten.
  assert.match(home, /deriveWorkspaceFirstRun\(/);
  assert.match(home, /mode === "live" \? operational\.rfqs \+ operational\.offers \+ operational\.orders : 0/);
  const checklistAt = home.indexOf("<WorkspaceFirstRunChecklist state={firstRun}");
  const feedAt = home.indexOf("<HomeFeed "); // HOME-FOCUS1 (founder decision, 4 Nov 2026): the Home RFQ box and the "Cosa richiede attenzione" strip were removed; superseded checks rewritten.
  assert.ok(checklistAt !== -1 && feedAt > checklistAt, "setup in the left rail precedes the centre column");
  assert.match(home, /source: firstRun\.active \? "first_run" : null/);
});

test("HOME-FIRSTRUN1 checklist is server-rendered, accessible and links only to existing setup routes", () => {
  assert.doesNotMatch(checklist, /"use client"/);
  assert.doesNotMatch(checklist, /fetch\(|createClient|supabase/);
  assert.match(checklist, /role="progressbar"/);
  assert.match(checklist, /aria-valuenow=\{essentialCompleted\}/);
  assert.match(checklist, /<ol /);
  assert.match(checklist, /Continua setup/);
  assert.match(checklist, /className="sr-only">: \{step\.label\}/);
  assert.match(checklist, /if \(!state\.active \|\| !state\.nextStep\) return null/);
});
