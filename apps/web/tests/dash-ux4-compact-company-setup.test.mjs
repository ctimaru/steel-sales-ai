import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");

test("DASH-UX4 setup follows compact attention and precedes the feed", () => {
  const priority = source.indexOf('<section aria-labelledby="daily-priorities"');
  const setup = source.indexOf('aria-label="Configurazione aziendale"');
  const feed = source.indexOf('<DashboardSteelPulse state={pulse} />');
  assert.ok(priority !== -1 && setup > priority && feed > setup);
});

test("DASH-UX4 keeps admin-only, incomplete-only company-scoped setup", () => {
  assert.match(source, /const isAdmin = context\.role === "admin"/);
  assert.match(source, /isAdmin\s*\? getCompanySetupState\(context\.organizationId\)/);
  assert.match(source, /setupIncomplete && setup && nextSetupAction/);
  assert.match(source, /!setup\.profile_ready \|\| !setup\.data_ready \|\| !setup\.first_value_ready/);
  assert.match(source, /href=\{nextSetupAction\.href\}/);
});

test("DASH-UX4 setup is a low-density responsive row without changing destinations", () => {
  assert.match(source, /aria-label="Configurazione aziendale" className="rounded-xl/);
  assert.match(source, /sm:flex-row sm:items-center sm:justify-between/);
  assert.match(source, /Continua setup/);
  assert.match(source, /appRoutes\.company\.setup/);
  assert.match(source, /appRoutes\.operations\.uploads/);
});
