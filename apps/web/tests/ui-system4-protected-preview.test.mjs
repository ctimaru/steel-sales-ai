import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../../../.github/workflows/ui-system4-vercel-preview.yml", import.meta.url), "utf8");
const browser = readFileSync(new URL("./ui-system4-chrome-contrast.mjs", import.meta.url), "utf8");

test("UI4 visual preview requires a GitHub secret and fails before installing Chrome", () => {
  const preflight = workflow.indexOf("name: Require Vercel preview automation bypass");
  const install = workflow.indexOf("npm install --no-save");
  assert.ok(preflight !== -1 && install > preflight);
  assert.match(workflow, /secrets\.VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.match(workflow, /if \[\[ -z "\$UI4_VERCEL_BYPASS" \]\]/);
  assert.match(workflow, /Do not disable protection/);
  assert.doesNotMatch(workflow, /x-vercel-protection-bypass:\s*[A-Za-z0-9]{32}/);
});

test("UI4 Chrome bypasses preview safely with header and persistent in-browser cookie", () => {
  assert.match(browser, /"x-vercel-protection-bypass": process\.env\.UI4_VERCEL_BYPASS/);
  assert.match(browser, /"x-vercel-set-bypass-cookie": "true"/);
  assert.match(browser, /Deployment Protection is blocking the preview/);
  assert.doesNotMatch(browser, /x-vercel-protection-bypass=[A-Za-z0-9]{32}/);
});
