import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// HOME-FEED1 (founder decision, 4 Nov 2026): Home is a three-column feed; superseded layout checks rewritten.
const source = readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");
const checklist = readFileSync(new URL("../components/workspace-first-run-checklist.tsx", import.meta.url), "utf8");

test("DASH-UX4 setup sits in the left rail before RFQ status and the feed", () => {
  const setup = source.indexOf("<WorkspaceFirstRunChecklist");
  const rfq = source.indexOf('data-testid="home-rfq-summary"');
  const feed = source.indexOf("<HomeFeed ");
  assert.ok(setup !== -1 && rfq > setup && feed > rfq);
});

test("DASH-UX4 keeps admin-only, incomplete-only company-scoped setup", () => {
  assert.match(source, /const isAdmin = context\.role === "admin"/);
  assert.match(source, /isAdmin\s*\? getCompanySetupState\(context\.organizationId\)/);
  assert.match(checklist, /if \(!state\.active \|\| !state\.nextStep\) return null/);
});

test("DASH-UX4 setup stays compact without changing destinations", () => {
  assert.match(checklist, /compact \? "mt-3 grid gap-1\.5"/);
  assert.match(checklist, /Continua setup/);
  assert.match(source, /appRoutes\.company\.setup/);
  assert.match(source, /appRoutes\.operations\.uploads/);
});
