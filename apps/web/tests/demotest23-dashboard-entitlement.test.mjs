import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");
const workflow = fs.readFileSync(new URL("../../.github/workflows/demotest2-3-chrome-auth.yml", import.meta.url), "utf8");
const browser = fs.readFileSync(new URL("./demotest23-chrome-auth.mjs", import.meta.url), "utf8");

test("DEMOTEST2.3 Dashboard does not call privileged Network reads without tenant entitlement", () => {
  assert.match(source, /getNetworkAccessState\(context\.organizationId\)/);
  assert.match(source, /can_access_network/);
  assert.match(source, /networkEntitled\s*\?\s*getNetworkInquiries/);
  assert.match(source, /networkEntitled\s*\?\s*getNetworkActivityFeed/);
  assert.doesNotMatch(source, /networkEnabled\s*\?\s*getNetwork(Inquiries|ActivityFeed)/);
});

test("DEMOTEST2.3 Chrome checks actual local Auth and cross-tenant UI denials", () => {
  assert.match(workflow, /supabase start/);
  assert.match(workflow, /supabase db reset --local/);
  assert.match(workflow, /supabase stop --no-backup/);
  assert.match(workflow, /127\.0\.0\.1:3000/);
  assert.match(browser, /chromium\.launch\(\{ headless: true, channel: "chrome" \}\)/);
  assert.match(browser, /page\.getByRole\("button", \{ name: "Accedi"/);
  assert.match(browser, /Cross-tenant direct URL must be 404/);
  assert.match(browser, /mobile responsive/);
  assert.doesNotMatch(workflow, /www\.smartsteelsales\.com|supabase\.co/);
});
